import ReactionGame from "@/components/games/fitt&hick";

export default function ReactionGamePage() {
  return (
    <div className="h-screen">
      <ReactionGame
        stage="early"
        onComplete={(data) => {
          console.log("Game Result:", data);
        }}
      />
    </div>
  );
}