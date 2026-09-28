"use client";

import { Radio } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Panel, PanelHeader } from "@/components/shell/panel";
import { cn } from "@/lib/utils";
import { formatMs } from "@/lib/speed";
import type { LatencyTarget } from "@/types";

interface LatencyTableProps {
  targets: LatencyTarget[];
  isLoading: boolean;
}

function pingTone(ms: number): string {
  if (ms <= 0) return "text-ink-4";
  if (ms < 50) return "text-link";
  if (ms < 150) return "text-amber";
  return "text-fault";
}

/** Current-route targets first, then one group per line, in arrival order. */
function groups(
  targets: LatencyTarget[],
): { title: string; rows: LatencyTarget[] }[] {
  const out: { title: string; rows: LatencyTarget[] }[] = [];
  for (const t of targets) {
    const title = t.line ? `Via ${t.line}` : "Current route";
    let g = out.find((x) => x.title === title);
    if (!g) {
      g = { title, rows: [] };
      out.push(g);
    }
    g.rows.push(t);
  }
  return out;
}

function Loss({ t }: { t: LatencyTarget }) {
  return (
    <span className={t.loss > 0 ? "text-fault" : "text-ink-3"}>
      {t.loss.toFixed(0)}% loss
    </span>
  );
}

export function LatencyTable({ targets, isLoading }: LatencyTableProps) {
  if (isLoading && targets.length === 0) {
    return (
      <Panel>
        <PanelHeader title="Results" icon={<Radio />} />
        <Skeleton className="h-[200px] w-full" />
      </Panel>
    );
  }

  if (targets.length === 0) {
    return (
      <Panel>
        <PanelHeader title="Results" icon={<Radio />} />
        <div className="flex h-[160px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-hairline-strong text-sm text-ink-3">
          <Radio className="size-5 text-ink-4" />
          Run a latency test to see how quickly each host answers.
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      className={cn("p-0 md:p-0", isLoading && "opacity-60 transition-opacity")}
    >
      <PanelHeader
        title="Results"
        icon={<Radio />}
        className="mb-0 px-4 pt-4 pb-3 md:px-5"
      />

      {/* Phone: stacked rows */}
      <div className="md:hidden">
        {groups(targets).map((g) => (
          <div key={g.title}>
            <div className="eyebrow border-t border-hairline-soft bg-inset/40 px-4 py-1.5">
              {g.title}
            </div>
            <ul className="divide-y divide-hairline-soft border-t border-hairline-soft">
              {g.rows.map((t) => (
                <li
                  key={t.host}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">
                      {t.name}
                    </div>
                    <div className="truncate font-mono text-xs text-ink-4">
                      {t.host}
                    </div>
                  </div>
                  <div className="num shrink-0 text-right font-mono">
                    {t.error ? (
                      <span className="text-xs text-fault">{t.error}</span>
                    ) : (
                      <>
                        <div
                          className={cn(
                            "text-sm font-medium",
                            pingTone(t.ping),
                          )}
                        >
                          {formatMs(t.ping)} ms
                        </div>
                        <div className="text-[11px] text-ink-4">
                          ±{formatMs(t.jitter)} · <Loss t={t} />
                        </div>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-hairline-soft text-left">
              {["Target", "Ping", "Min", "Max", "Jitter", "Loss"].map(
                (h, i) => (
                  <th
                    key={h}
                    className={cn(
                      "eyebrow px-5 py-2 font-medium",
                      i > 0 && "text-right",
                    )}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          {groups(targets).map((g) => (
            <tbody
              key={g.title}
              className="divide-y divide-hairline-soft border-t border-hairline-soft"
            >
              <tr>
                <th
                  colSpan={6}
                  className="eyebrow bg-inset/40 px-5 py-1.5 text-left font-medium"
                >
                  {g.title}
                </th>
              </tr>
              {g.rows.map((t) => (
                <tr
                  key={t.host}
                  className="transition-colors hover:bg-raised/40"
                >
                  <td className="px-5 py-2.5">
                    <div className="font-medium text-ink">{t.name}</div>
                    <div className="font-mono text-xs text-ink-4">{t.host}</div>
                  </td>
                  {t.error ? (
                    <td
                      colSpan={5}
                      className="px-5 py-2.5 text-right text-xs text-fault"
                    >
                      {t.error}
                    </td>
                  ) : (
                    <>
                      <td
                        className={cn(
                          "num px-5 py-2.5 text-right font-mono font-medium",
                          pingTone(t.ping),
                        )}
                      >
                        {formatMs(t.ping)} ms
                      </td>
                      <td className="num px-5 py-2.5 text-right font-mono text-ink-3">
                        {formatMs(t.min)}
                      </td>
                      <td className="num px-5 py-2.5 text-right font-mono text-ink-3">
                        {formatMs(t.max)}
                      </td>
                      <td className="num px-5 py-2.5 text-right font-mono text-ink-2">
                        {formatMs(t.jitter)}
                      </td>
                      <td className="num px-5 py-2.5 text-right font-mono">
                        <Loss t={t} />
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </Panel>
  );
}
