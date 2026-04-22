/**
 * routes/music.js
 *
 * All music therapy endpoints:
 *  GET  /api/music/:patientId/recommendations   — personalised track list
 *  GET  /api/music/:patientId/search            — search Jamendo by query
 *  GET  /api/music/:patientId/profile           — get music profile
 *  POST /api/music/:patientId/profile           — create/update music profile
 *  POST /api/music/:patientId/session           — log a listening session
 *  POST /api/music/:patientId/session/:sessionId/update — update play progress
 *  GET  /api/music/:patientId/impact            — caregiver: is therapy helping?
 */

const router        = require('express').Router();
const axios         = require('axios');
const DailyHealthLog  = require('../models/DailyHealthLog');
const ListeningSession = require('../models/ListeningSession');
const MusicProfile    = require('../models/MusicProfile');

const JAMENDO_CLIENT_ID = process.env.JAMENDO_CLIENT_ID || 'Appfd571ddc';
const JAMENDO_BASE      = 'https://api.jamendo.com/v3.0';

// ── Jamendo helper ────────────────────────────────────────────────────────────
const jamendoSearch = async (params = {}) => {
  const defaults = {
    client_id: JAMENDO_CLIENT_ID,
    format:    'json',
    limit:     20,
    include:   'musicinfo',
    audioformat: 'mp32',
  };
  const res = await axios.get(`${JAMENDO_BASE}/tracks`, {
    params: { ...defaults, ...params },
    timeout: 8000,
  });
  return res.data?.results || [];
};

const tempoToJamendoSpeed = (tempo) => {
  if (tempo === 'calm')      return 'low';
  if (tempo === 'energetic') return 'high';
  return 'medium';
};

const formatTrack = (t) => ({
  id:           String(t.id),
  name:         t.name,
  artist:       t.artist_name,
  album:        t.album_name,
  duration:     t.duration,
  audioUrl:     t.audio,
  imageUrl:     t.image || t.album_image || '',
  genre:        t.musicinfo?.tags?.genres?.[0] || '',
  tempo:        t.musicinfo?.speed || 'medium',
  tags:         t.musicinfo?.tags?.genres || [],
});

const dedupeTracks = (tracks = []) => {
  const seen = new Set();
  return tracks.filter((track) => {
    if (!track?.id || seen.has(track.id)) return false;
    seen.add(track.id);
    return true;
  });
};

// ── Scoring helper (content-based filtering) ──────────────────────────────────
const scoreTrackForProfile = (track, profile, interactions = []) => {
  let score = 0;
  const inter = interactions.find((i) => i.trackId === track.id);

  // Explicit feedback
  if (inter?.thumbsUp === true)  score += 5;
  if (inter?.thumbsUp === false) score -= 5;

  // Behaviour signals
  if (inter) {
    score += inter.repeatCount * 2;
    if (inter.completed) score += 2;
    if (inter.skipAtPercent !== null) {
      if (inter.skipAtPercent < 20) score -= 3;
      else if (inter.skipAtPercent < 50) score -= 1;
      else score += 0.5;
    }
  }

  // Preferred genres
  if (profile?.preferredGenres?.length && track.genre) {
    if (profile.preferredGenres.includes(track.genre)) score += 2;
  }

  // Preferred tempo
  if (profile?.preferredTempo && profile.preferredTempo !== 'mixed') {
    if (track.tempo === profile.preferredTempo) score += 2;
  }

  return score;
};

// ── GET profile ───────────────────────────────────────────────────────────────
router.get('/:patientId/profile', async (req, res) => {
  try {
    const profile = await MusicProfile.findOne({ patientId: req.params.patientId }).lean();
    res.json(profile || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST profile (caregiver sets preferences) ─────────────────────────────────
router.post('/:patientId/profile', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { birthYear, preferredGenres, preferredTempo, knownFavourites, language } = req.body;

    const update = {
      patientId,
      preferredGenres: Array.isArray(preferredGenres) ? preferredGenres : [],
      preferredTempo:  preferredTempo || 'mixed',
      knownFavourites: Array.isArray(knownFavourites) ? knownFavourites : [],
      language:        language || 'en',
      createdBy:       req.user?._id || null,
    };

    if (birthYear) {
      update.birthYear      = Number(birthYear);
      update.goldenEraStart = Number(birthYear) + 10;
      update.goldenEraEnd   = Number(birthYear) + 25;
    }

    const profile = await MusicProfile.findOneAndUpdate(
      { patientId },
      update,
      { upsert: true, new: true }
    );
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET recommendations ───────────────────────────────────────────────────────
router.get('/:patientId/recommendations', async (req, res) => {
  try {
    const { patientId } = req.params;
    const mood = req.query.mood || 'mixed'; // calm | energetic | mixed

    const [profile, recentLogs, interactions] = await Promise.all([
      MusicProfile.findOne({ patientId }).lean(),
      DailyHealthLog.find({ patientId }).sort({ date: -1 }).limit(3).lean(),
      ListeningSession.find({ patientId }).sort({ sessionDate: -1 }).limit(100).lean(),
    ]);

    const latestLog  = recentLogs[0] || null;
    const agitation  = latestLog?.agitationLevel ?? null;

    // Auto-detect best tempo from current mood
    let recommendedTempo = profile?.preferredTempo || 'mixed';
    if (mood === 'calm' || agitation >= 6) recommendedTempo = 'calm';
    if (mood === 'energetic') recommendedTempo = 'energetic';

    const genres = profile?.preferredGenres?.length
      ? profile.preferredGenres
      : ['pop', 'folk', 'classical'];

    // Build era filter from golden era
    let dateRange = null;
    if (profile?.goldenEraStart && profile?.goldenEraEnd) {
      dateRange = `${profile.goldenEraStart}-01-01_${profile.goldenEraEnd}-12-31`;
    }

    // Fetch from multiple genre buckets
    const fetchPromises = genres.slice(0, 3).map((genre) =>
      jamendoSearch({
        fuzzytags: genre,
        speed:     tempoToJamendoSpeed(recommendedTempo === 'mixed' ? 'medium' : recommendedTempo),
        ...(dateRange ? { daterange: dateRange } : {}),
        order:     'popularity_total',
        limit:     10,
      }).catch(() => [])
    );

    // Also fetch known favourites by name if set
    if (profile?.knownFavourites?.length) {
      fetchPromises.push(
        jamendoSearch({
          namesearch: profile.knownFavourites[0],
          limit: 8,
        }).catch(() => [])
      );
    }

    const results = await Promise.all(fetchPromises);
    const allTracks = results.flat().map(formatTrack);

    // Deduplicate by id
    const seen = new Set();
    const unique = allTracks.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

    // Score + sort
    const scored = unique
      .map((t) => ({ ...t, score: scoreTrackForProfile(t, profile, interactions) }))
      .sort((a, b) => b.score - a.score);

    // Separate calm and energetic sections
    const calm      = scored.filter((t) => t.tempo === 'low'  || t.tempo === 'calm').slice(0, 8);
    const energetic = scored.filter((t) => t.tempo === 'high' || t.tempo === 'energetic').slice(0, 8);
    const forYou    = scored.slice(0, 12);

    res.json({
      forYou,
      calm,
      energetic,
      recommendedTempo,
      profile: profile || null,
    });
  } catch (err) {
    console.error('[Music] recommendations error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET curated playlists (general songs, not profile-dependent) ─────────────
router.get('/:patientId/playlists', async (_req, res) => {
  try {
    const [calmRaw, soothingRaw, singAlongRaw] = await Promise.all([
      jamendoSearch({
        tags: 'calm,ambient,classical',
        speed: 'low',
        order: 'popularity_total',
        limit: 18,
      }).catch(() => []),
      jamendoSearch({
        tags: 'acoustic,relaxation,chillout',
        speed: 'low',
        order: 'popularity_total',
        limit: 18,
      }).catch(() => []),
      jamendoSearch({
        tags: 'vocal,jazz,pop',
        order: 'popularity_total',
        limit: 18,
      }).catch(() => []),
    ]);

    const playlists = {
      calm: dedupeTracks(calmRaw.map(formatTrack)).slice(0, 14),
      soothing: dedupeTracks(soothingRaw.map(formatTrack)).slice(0, 14),
      singAlong: dedupeTracks(singAlongRaw.map(formatTrack)).slice(0, 14),
    };

    res.json({ playlists });
  } catch (err) {
    console.error('[Music] playlists error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET search ────────────────────────────────────────────────────────────────
router.get('/:patientId/search', async (req, res) => {
  try {
    const { q = '' } = req.query;
    const term = String(q || '').trim();
    if (!term) return res.json({ tracks: [] });

    const [byName, byTags, byArtist] = await Promise.all([
      jamendoSearch({
        namesearch: term,
        order: 'popularity_total',
        limit: 30,
      }).catch(() => []),
      jamendoSearch({
        fuzzytags: term,
        order: 'popularity_total',
        limit: 25,
      }).catch(() => []),
      jamendoSearch({
        artist_name: term,
        order: 'popularity_total',
        limit: 25,
      }).catch(() => []),
    ]);

    const tracks = dedupeTracks([...byName, ...byTags, ...byArtist].map(formatTrack)).slice(0, 50);
    res.json({ tracks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST session (start tracking) ────────────────────────────────────────────
router.post('/:patientId/session', async (req, res) => {
  try {
    const { patientId } = req.params;
    const {
      trackId, trackName, artistName, genre,
      tempo, era, durationSeconds
    } = req.body;

    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';

    // Grab current mood/agitation from latest log
    const latestLog = await DailyHealthLog.findOne({ patientId }).sort({ date: -1 }).lean();

    const session = await ListeningSession.create({
      patientId,
      trackId:         String(trackId),
      trackName:       trackName || '',
      artistName:      artistName || '',
      genre:           genre || '',
      tempo:           tempo || 'medium',
      era:             era || '',
      durationSeconds: Number(durationSeconds) || 0,
      moodBefore:      latestLog?.moodScore ?? null,
      agitationBefore: latestLog?.agitationLevel ?? null,
      timeOfDay,
      sessionDate:     new Date(),
    });

    res.status(201).json({ sessionId: session._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST session update (track behaviour while playing) ───────────────────────
router.post('/:patientId/session/:sessionId/update', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const {
      listenedSeconds, skipAtPercent,
      completed, repeatCount, thumbsUp
    } = req.body;

    const update = {};
    if (listenedSeconds != null)  update.listenedSeconds = Number(listenedSeconds);
    if (skipAtPercent != null)    update.skipAtPercent   = Number(skipAtPercent);
    if (completed != null)        update.completed       = Boolean(completed);
    if (repeatCount != null)      update.repeatCount     = Number(repeatCount);
    if (thumbsUp != null)         update.thumbsUp        = Boolean(thumbsUp);

    // Attach post-session mood if session is ending
    if (completed || skipAtPercent != null) {
      const session  = await ListeningSession.findById(sessionId).lean();
      if (session?.patientId) {
        const latestLog = await DailyHealthLog.findOne({ patientId: session.patientId })
          .sort({ date: -1 }).lean();
        if (latestLog) {
          update.moodAfter      = latestLog.moodScore      ?? null;
          update.agitationAfter = latestLog.agitationLevel ?? null;
        }
      }
    }

    await ListeningSession.findByIdAndUpdate(sessionId, update);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET impact (caregiver: is therapy helping?) ────────────────────────────────
router.get('/:patientId/impact', async (req, res) => {
  try {
    const { patientId } = req.params;
    const days = Math.min(Number(req.query.days || 30), 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [sessions, allLogs] = await Promise.all([
      ListeningSession.find({ patientId, sessionDate: { $gte: since } }).lean(),
      DailyHealthLog.find({ patientId, date: { $gte: since } }).lean(),
    ]);

    if (!sessions.length) {
      return res.json({
        hasData: false,
        message: 'No listening sessions recorded yet.',
        sessions: 0,
      });
    }

    // Days with sessions vs days without
    const sessionDates = new Set(
      sessions.map((s) => new Date(s.sessionDate).toDateString())
    );

    const logsWithMusic    = allLogs.filter((l) => sessionDates.has(new Date(l.date).toDateString()));
    const logsWithoutMusic = allLogs.filter((l) => !sessionDates.has(new Date(l.date).toDateString()));

    const avg = (arr, key) => {
      const vals = arr.map((l) => l[key]).filter((v) => v != null && Number.isFinite(Number(v)));
      return vals.length ? Number((vals.reduce((s, v) => s + Number(v), 0) / vals.length).toFixed(1)) : null;
    };

    const moodWithMusic    = avg(logsWithMusic,    'moodScore');
    const moodWithoutMusic = avg(logsWithoutMusic, 'moodScore');
    const agitWithMusic    = avg(logsWithMusic,    'agitationLevel');
    const agitWithoutMusic = avg(logsWithoutMusic, 'agitationLevel');

    // Engagement metrics
    const totalSessions    = sessions.length;
    const completedCount   = sessions.filter((s) => s.completed).length;
    const completionRate   = Math.round((completedCount / totalSessions) * 100);
    const avgListenPercent = Math.round(
      sessions
        .filter((s) => s.durationSeconds > 0)
        .reduce((sum, s) => sum + (s.listenedSeconds / s.durationSeconds) * 100, 0)
      / Math.max(1, sessions.filter((s) => s.durationSeconds > 0).length)
    );
    const repeatRate = Math.round(
      (sessions.filter((s) => s.repeatCount > 0).length / totalSessions) * 100
    );
    const thumbsUpRate = Math.round(
      (sessions.filter((s) => s.thumbsUp === true).length /
       Math.max(1, sessions.filter((s) => s.thumbsUp !== null).length)) * 100
    );

    // Most played tracks
    const trackCounts = {};
    sessions.forEach((s) => {
      const key = s.trackId;
      if (!trackCounts[key]) trackCounts[key] = { name: s.trackName, artist: s.artistName, count: 0, repeats: 0 };
      trackCounts[key].count++;
      trackCounts[key].repeats += s.repeatCount || 0;
    });
    const topTracks = Object.values(trackCounts)
      .sort((a, b) => (b.count + b.repeats) - (a.count + a.repeats))
      .slice(0, 5);

    // Early skip analysis
    const earlySkips = sessions.filter((s) => s.skipAtPercent !== null && s.skipAtPercent < 30);
    const mostSkipped = {};
    earlySkips.forEach((s) => {
      if (!mostSkipped[s.trackId]) mostSkipped[s.trackId] = { name: s.trackName, count: 0 };
      mostSkipped[s.trackId].count++;
    });

    // Overall helping signal
    let helpingSignal = 'neutral';
    let helpingMessage = 'Not enough data to determine impact yet.';
    if (moodWithMusic !== null && moodWithoutMusic !== null) {
      const moodDelta = moodWithMusic - moodWithoutMusic;
      const agitDelta = agitWithoutMusic !== null && agitWithMusic !== null
        ? agitWithoutMusic - agitWithMusic : 0;

      if (moodDelta >= 1 || agitDelta >= 1) {
        helpingSignal  = 'positive';
        helpingMessage = `Mood is ${moodDelta.toFixed(1)} points higher and agitation is ${agitDelta.toFixed(1)} points lower on music days.`;
      } else if (moodDelta <= -0.5) {
        helpingSignal  = 'negative';
        helpingMessage = 'Mood appears slightly lower on music days. Consider adjusting the tempo or genre.';
      } else {
        helpingSignal  = 'neutral';
        helpingMessage = 'Music therapy shows a neutral effect so far. More sessions will give a clearer picture.';
      }
    }

    res.json({
      hasData:         true,
      periodDays:      days,
      helpingSignal,
      helpingMessage,
      sessions:        totalSessions,
      completionRate,
      avgListenPercent,
      repeatRate,
      thumbsUpRate,
      moodWithMusic,
      moodWithoutMusic,
      agitationWithMusic:    agitWithMusic,
      agitationWithoutMusic: agitWithoutMusic,
      topTracks,
      mostSkipped: Object.values(mostSkipped).sort((a, b) => b.count - a.count).slice(0, 3),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;