const GameModuleHost = ({ module, context = {} }) => {
  const GameComponent = module?.component;

  if (!module || !GameComponent) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          This game module is not available right now.
        </p>
      </div>
    );
  }

  const moduleProps =
    typeof module.buildProps === "function" ? module.buildProps(context) : {};

  return <GameComponent {...moduleProps} />;
};

export default GameModuleHost;
