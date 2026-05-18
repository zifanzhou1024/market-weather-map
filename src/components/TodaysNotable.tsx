import type { ScoreHistoryFile, SignalPriorityFile } from "../lib/types";
import TopSignalList from "./TopSignalList";
import WhatChangedColumn from "./WhatChangedColumn";

interface Props {
  signals: SignalPriorityFile | null;
  history: ScoreHistoryFile | null;
}

export default function TodaysNotable({ signals, history }: Props) {
  return (
    <section
      className="todays-notable"
      data-testid="todays-notable"
      aria-label="Today's notable signals"
    >
      <TopSignalList
        title="Top Active Warnings"
        emptyText="No top active warnings in the current snapshot."
        variant="warning"
        signals={signals?.top_warnings ?? []}
      />
      <TopSignalList
        title="Top Active Supports"
        emptyText="No top active supports in the current snapshot."
        variant="support"
        signals={signals?.top_supports ?? []}
      />
      <WhatChangedColumn history={history} />
    </section>
  );
}
