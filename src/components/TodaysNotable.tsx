import type { ScoreHistoryFile, SignalPriorityFile } from "../lib/types";
import TopSignalList from "./TopSignalList";
import WhatChangedColumn from "./WhatChangedColumn";
import { useT } from "../lib/i18n";

interface Props {
  signals: SignalPriorityFile | null;
  history: ScoreHistoryFile | null;
}

export default function TodaysNotable({ signals, history }: Props) {
  const { t } = useT();
  return (
    <section
      className="todays-notable"
      data-testid="todays-notable"
      aria-label={t("panels.todaysNotableLabel")}
    >
      <TopSignalList
        title={t("sections.topActiveWarnings")}
        emptyText={t("panels.noTopActiveWarnings")}
        variant="warning"
        signals={signals?.top_warnings ?? []}
      />
      <TopSignalList
        title={t("sections.topActiveSupports")}
        emptyText={t("panels.noTopActiveSupports")}
        variant="support"
        signals={signals?.top_supports ?? []}
      />
      <WhatChangedColumn history={history} />
    </section>
  );
}
