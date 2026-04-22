import { Check, Circle } from "lucide-react";

interface Task {
  id: string;
  title: string;
  completed: boolean;
  scheduledTime?: string | null;
}

interface TaskListProps {
  tasks: Task[];
  onToggle: (id: string) => void;
}

const TaskList = ({ tasks, onToggle }: TaskListProps) => {
  return (
    <div className="patient-card animate-fade-in !p-3 min-h-0">
      <h2 className="text-base font-display font-bold text-foreground mb-2">
        Today's Tasks
      </h2>
      
      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
        {tasks.map((task) => (
          <button
            key={task.id}
            onClick={() => onToggle(task.id)}
            className={`w-full flex items-center gap-2 p-2 rounded-xl border transition-all duration-300 text-left
              ${task.completed 
                ? "bg-safe/10 border-safe/30" 
                : "bg-secondary/50 border-border hover:border-primary/30 hover:bg-secondary"
              }`}
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all
              ${task.completed 
                ? "bg-safe text-safe-foreground" 
                : "bg-muted text-muted-foreground"
              }`}
            >
              {task.completed ? <Check className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                {task.title}
              </p>
              {task.scheduledTime && (
                <p className="text-[11px] text-muted-foreground">
                  {new Date(task.scheduledTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default TaskList;
