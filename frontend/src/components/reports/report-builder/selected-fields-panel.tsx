import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import { GripVertical, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ReportField } from "@/types/custom-report";
import { FIELD_TYPE_COLORS } from "./constants";

interface SelectedFieldsPanelProps {
  fields: ReportField[];
  onDragEnd: (result: DropResult) => void;
  onUpdateLabel: (key: string, label: string) => void;
  onRemove: (key: string) => void;
}

export function SelectedFieldsPanel({
  fields,
  onDragEnd,
  onUpdateLabel,
  onRemove,
}: SelectedFieldsPanelProps) {
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">
          Selected columns
          <Badge variant="secondary" className="ml-2">
            {fields.length}
          </Badge>
        </CardTitle>
        <CardDescription className="text-xs">
          Drag to reorder. Click the label to rename.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3">
        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Select fields from the panel on the left to add columns.
          </p>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="fields" direction="horizontal">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="flex flex-wrap gap-2"
                >
                  {fields.map((field, index) => (
                    <Draggable key={field.key} draggableId={field.key} index={index}>
                      {(drag, snapshot) => (
                        <div
                          ref={drag.innerRef}
                          {...drag.draggableProps}
                          className={cn(
                            "flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs shadow-sm",
                            snapshot.isDragging && "ring-2 ring-primary",
                          )}
                        >
                          <span
                            {...drag.dragHandleProps}
                            className="cursor-grab text-muted-foreground active:cursor-grabbing"
                          >
                            <GripVertical className="h-3 w-3" />
                          </span>
                          <span
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={(e) =>
                              onUpdateLabel(
                                field.key,
                                e.currentTarget.textContent ?? field.label,
                              )
                            }
                            className="outline-none focus:underline"
                          >
                            {field.label}
                          </span>
                          <span
                            className={cn(
                              "rounded px-1 py-0.5 text-[9px] font-medium",
                              FIELD_TYPE_COLORS[field.type],
                            )}
                          >
                            {field.type}
                          </span>
                          <button
                            type="button"
                            onClick={() => onRemove(field.key)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </CardContent>
    </Card>
  );
}
