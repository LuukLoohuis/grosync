import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: { label: string; onClick: () => void };
}

const EmptyState = ({ icon: Icon, title, body, action }: EmptyStateProps) => (
  <div className="rounded-2xl border border-dashed border-border-strong/80 bg-background px-[18px] py-[22px] text-center">
    <span className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] bg-primary-soft text-primary" aria-hidden="true">
      <Icon className="h-[22px] w-[22px]" strokeWidth={1.8} />
    </span>
    <p className="mt-2.5 font-display text-[1.0625rem] font-semibold text-foreground">{title}</p>
    <p className="mx-auto mt-1 max-w-[34ch] text-[0.8125rem] leading-[1.45] text-muted-foreground">{body}</p>
    {action && (
      <Button className="mt-3" onClick={action.onClick}>
        {action.label}
      </Button>
    )}
  </div>
);

export default EmptyState;
