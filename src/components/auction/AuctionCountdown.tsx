"use client";

import { useEffect, useState } from "react";
import { formatCountdown } from "@/lib/utils";
import { useTranslations } from "@/i18n/provider";

export function AuctionCountdown({ endTime }: { endTime: string }) {
  const [now, setNow] = useState(() => Date.now());
  const t = useTranslations("auction");

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const { hours, minutes, seconds, ended } = formatCountdown(endTime, new Date(now));

  if (ended) {
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-grey-500">{t("endsIn")}</p>
        <p className="mt-1 text-2xl font-extrabold text-error-600">— {t("ended")} —</p>
      </div>
    );
  }

  // Under an hour: switch the digits to alarm-red.
  const urgent = new Date(endTime).getTime() - now <= 3_600_000;

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-grey-500">{t("endsIn")}</p>
      <div className="mt-1.5 flex items-end gap-1.5">
        <Cell value={hours}   label="hh" urgent={urgent} />
        <Sep />
        <Cell value={minutes} label="mm" urgent={urgent} />
        <Sep />
        <Cell value={seconds} label="ss" urgent={urgent} />
      </div>
    </div>
  );
}

function Cell({ value, label, urgent }: { value: string; label: string; urgent?: boolean }) {
  return (
    <div className="text-center">
      <div className={
        "rounded-lg px-3 py-2 font-mono text-2xl font-bold tabular-nums text-white shadow-inner sm:text-3xl " +
        (urgent ? "bg-error-600" : "bg-grey-900")
      }>
        {value}
      </div>
      <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-grey-400">
        {label}
      </div>
    </div>
  );
}

function Sep() {
  return <div className="pb-7 text-2xl font-bold text-grey-300 sm:text-3xl">:</div>;
}
