'use client';

import { useState } from 'react';
import { Clock, Trash2, Calendar, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import type { ScheduledTask } from '@/types';

interface ScheduledTasksProps {
  tasks: ScheduledTask[];
  isLoading: boolean;
  onDelete: (name: string) => Promise<void>;
  onRefresh: () => void;
}

function formatInterval(interval: string): string {
  if (!interval) return 'Once';
  if (interval === '1d' || interval === '1d 00:00:00') return 'Daily';
  if (interval === '7d' || interval === '7d 00:00:00') return 'Weekly';
  if (interval === '30d' || interval === '30d 00:00:00') return 'Monthly';
  return interval;
}

function formatTime(startTime: string): string {
  if (!startTime) return '-';
  // Convert HH:MM:SS to HH:MM
  const parts = startTime.split(':');
  if (parts.length >= 2) {
    return `${parts[0]}:${parts[1]}`;
  }
  return startTime;
}

export function ScheduledTasks({
  tasks,
  isLoading,
  onDelete,
  onRefresh,
}: ScheduledTasksProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Scheduled Tasks
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No scheduled tasks</p>
            <p className="text-sm">Schedule a reboot using the button above</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Interval</TableHead>
                <TableHead>Next Run</TableHead>
                <TableHead>Runs</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <ScheduledTaskRow
                  key={task.id || task.name}
                  task={task}
                  onDelete={onDelete}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ScheduledTaskRow({
  task,
  onDelete,
}: {
  task: ScheduledTask;
  onDelete: (name: string) => Promise<void>;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(task.name);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <TableRow className={task.disabled ? 'opacity-50' : ''}>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {task.name}
          {task.disabled && (
            <Badge variant="secondary" className="text-xs">
              Disabled
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>{formatTime(task.startTime)}</TableCell>
      <TableCell>
        <Badge variant="outline">{formatInterval(task.interval)}</Badge>
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {task.nextRun || '-'}
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {task.rebootCount > 0 ? task.rebootCount : task.runCount || '0'}
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          disabled={isDeleting}
          className="h-8 w-8 text-destructive hover:text-destructive"
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </TableCell>
    </TableRow>
  );
}
