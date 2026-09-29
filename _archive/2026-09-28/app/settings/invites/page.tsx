"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  CalendarClock,
  Check,
  CircleDollarSign,
  Coins,
  Copy,
  FileDown,
  Gift,
  KeyRound,
  Link2,
  Star,
  Trash2,
} from "lucide-react";
import { KeyValue, Sheet, SheetActions } from "@/components/ig-ui";
import { useCountUp } from "@/components/charts";
import {
  ActionRow,
  Group,
  Helper,
  PageSkeleton,
  SectionTitle,
  SettingsPage,
  StaticRow,
} from "@/components/settings-shell";
import {
  REWARDS,
  readInvites,
  recordShare,
  redeem,
  type InviteSummary,
  type Reward,
} from "@/lib/invites";
import { POINTS_PER_INVITE_SENT, POINTS_PER_SIGNUP } from "@/lib/referrals";
import { ago } from "@/lib/dates";
import { haptic } from "@/lib/haptics";
import { useToast } from "@/lib/use-toast";

/* ═══════════════════════════════════════════════════════════════════
   Invites and referrals

   The link first, because that's the only thing here you can act on. The
   balance under it, because that's the answer to "what have I got". Then
   the rewards, each one quoting a limit another page in these settings
   already enforces, and then every record behind the numbers — so a point
   is never a figure you have to take on faith.

   There is no server. The copies, the joins and the redemptions are all
   written down in this browser, which means these totals belong to this
   device and another browser starts at zero.
   ═══════════════════════════════════════════════════════════════════ */

const REWARD_ICON: Record<string, ReactNode> = {
  archives: <FileDown className="size-[18px]" strokeWidth={1.8} />,
  trash: <Trash2 className="size-[18px]" strokeWidth={1.8} />,
  passkeys: <KeyRound className="size-[18px]" strokeWidth={1.8} />,
  grace: <CalendarClock className="size-[18px]" strokeWidth={1.8} />,
};

function legacyCopy(text: string): boolean {
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.top = "-9999px";
  document.body.appendChild(field);
  field.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(field);
  return ok;
}

/** "2 more joins" / "1 more join" — the gap to a reward said in the unit the
    reader can actually cause. */
function joinsFor(points: number): string {
  const joins = Math.ceil(points / POINTS_PER_SIGNUP);
  return `${joins} more ${joins === 1 ? "join" : "joins"}`;
}

export default function InvitesPage() {
  const [saved, setData] = useState<InviteSummary | null>(null);
  const [copied, setCopied] = useState(false);
  const [pick, setPick] = useState<Reward | null>(null);
  const toast = useToast();

  useEffect(() => {
    setData(readInvites());
  }, []);

  if (!saved) return <PageSkeleton title="Invites and referrals" sections={4} />;

  const data = saved;
  const cheapest = Math.min(...REWARDS.map((reward) => reward.cost));
  const shortBy = Math.max(0, cheapest - data.available);

  async function copyLink() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(data.link);
      ok = true;
    } catch {
      ok = legacyCopy(data.link);
    }
    if (!ok) {
      haptic("error");
      toast.error("This browser blocked the copy — select the link above and copy it yourself");
      return;
    }
    setData(recordShare());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
    toast.success("Link copied");
  }

  function blocked(reward: Reward) {
    const short = reward.cost - data.available;
    haptic("error");
    toast.error(`${short} points short — ${joinsFor(short)} would cover it`);
  }

  function confirmRedeem() {
    if (!pick) return;
    const reward = pick;
    const result = redeem(reward);
    setPick(null);
    if (!result.ok) {
      haptic("error");
      toast.error(`${result.shortBy} points short of ${reward.label.toLowerCase()}`);
      return;
    }
    setData(result.summary);
    haptic("success");
    toast.success(`${reward.cost} points redeemed`);
  }

  return (
    <SettingsPage title="Invites and referrals">

      {/* ── The link ── */}
      <SectionTitle desc="Anyone who opens the sign-up page through this link is captured as your invite, and the join pays once they finish. Send it anywhere — a message, an email, a note on someone else's screen.">
        Your invite link
      </SectionTitle>
      <Group>
        <StaticRow
          icon={<Link2 className="size-[18px]" strokeWidth={1.8} />}
          title="Link"
          sub={data.link}
        />
        <ActionRow
          icon={copied ? <Check className="size-[18px]" strokeWidth={1.8} /> : <Copy className="size-[18px]" strokeWidth={1.8} />}
          title={copied ? "Copied" : "Copy link"}
          sub={`Puts the link on your clipboard, ready to paste anywhere. A copy counts as a share, which pays ${POINTS_PER_INVITE_SENT} points.`}
          opens={false}
          onClick={() => {
            void copyLink();
          }}
        />
        <StaticRow oneLine title="Your invite code" sub={data.code} />
      </Group>

      {/* ── The balance ── */}
      <SectionTitle desc="Points come in when someone joins through your link and when you copy it, and they go out when you redeem a reward. Every one of them is a dated record in the lists at the bottom of this page.">
        Points
      </SectionTitle>
      <p className="-mt-2 flex items-baseline gap-2">
        <span className="text-[30px] leading-none font-bold tracking-tight tabular-nums">
          <Counter value={data.available} />
        </span>
        <span className="text-[14px] text-muted">points ready to redeem</span>
      </p>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
        {shortBy
          ? `The cheapest reward costs ${cheapest}, so you're ${shortBy} short of it. A join is worth ${POINTS_PER_SIGNUP}, so ${joinsFor(shortBy)} would cover that.`
          : `The cheapest reward is ${cheapest} points, so there's one you can redeem right now.`}
      </p>
      <div className="mt-4">
        <Group>
          <StaticRow
            icon={<Gift className="size-[18px]" strokeWidth={1.8} />}
            title="Invites that joined"
            sub="People who signed up with your link from this browser."
            right={`${data.joined}`}
          />
          <StaticRow
            icon={<Star className="size-[18px]" strokeWidth={1.8} />}
            title="Earned"
            sub="Everything your joins and your shares have paid in."
            right={`${data.earned}`}
          />
          <StaticRow
            icon={<CircleDollarSign className="size-[18px]" strokeWidth={1.8} />}
            title="Redeemed"
            sub="Taken off the balance by rewards you asked for."
            right={`${data.redeemed}`}
          />
        </Group>
      </div>

      {/* ── The rewards ── */}
      <SectionTitle desc="Each reward asks for something that already has a fixed number elsewhere in these settings — a daily allowance, a retention window, a limit on how many keys you can hold. The line under its name quotes the number that page applies today.">
        Rewards
      </SectionTitle>
      <Group>
        {REWARDS.map((reward) => (
          <ActionRow
            key={reward.id}
            icon={REWARD_ICON[reward.id]}
            title={reward.label}
            sub={reward.sub}
            right={`${reward.cost}`}
            disabled={data.available < reward.cost}
            blockedHint={() => blocked(reward)}
            onClick={() => setPick(reward)}
          />
        ))}
      </Group>
      <Helper>
        Nothing lifts those limits on its own yet — there's no server behind them, so a redemption
        is your own dated record of asking. Open one and it says so before it takes anything off
        your balance.
      </Helper>

      {/* ── The records ── */}
      <SectionTitle>What earned points</SectionTitle>
      {data.income.length ? (
        <Group>
          {data.income.map((record, i) => (
            <StaticRow
              key={`${record.label}-${i}`}
              icon={<Coins className="size-[18px]" strokeWidth={1.8} />}
              title={record.label}
              sub={record.at === null ? "No date was recorded for this one" : `Paid ${ago(record.at)}`}
              right={`+${record.points}`}
            />
          ))}
        </Group>
      ) : (
        <Helper>
          Nothing has come in yet. The first person who signs up through your link lands here with
          the day it happened and what it paid.
        </Helper>
      )}

      {data.redemptions.length ? (
        <>
          <SectionTitle>What you've redeemed</SectionTitle>
          <Group>
            {data.redemptions.map((record, i) => (
              <StaticRow
                key={`${record.label}-${i}`}
                icon={<CircleDollarSign className="size-[18px]" strokeWidth={1.8} />}
                title={record.label}
                sub={record.at === null ? "No date was recorded for this one" : `Redeemed ${ago(record.at)}`}
                right={`${record.points}`}
              />
            ))}
          </Group>
        </>
      ) : null}

      {pick ? (
        <Sheet
          title={pick.label}
          description={pick.sub}
          onClose={() => setPick(null)}
          footer={
            <SheetActions
              cancelLabel="Cancel"
              onCancel={() => setPick(null)}
              confirmLabel={`Redeem for ${pick.cost}`}
              onConfirm={confirmRedeem}
              disabled={data.available < pick.cost}
            />
          }
        >
          <div className="-mx-4 px-4 pb-2 pt-1 sm:-mx-5 sm:px-5">
            <KeyValue
              columns={1}
              rows={[
                { key: "Reward", value: pick.label },
                { key: "Cost", value: `${pick.cost} points` },
                { key: "Balance now", value: `${data.available} points` },
                { key: "After redeeming", value: `${Math.max(0, data.available - pick.cost)} points` },
              ]}
            />
            <p className="mt-4 text-[13px] leading-relaxed text-muted">
              Redeeming takes {pick.cost} points off your balance and dates an entry under What
              you've redeemed. Nothing else on the account changes — there's no server to apply
              this yet, so the entry is your own record of asking.
            </p>
          </div>
        </Sheet>
      ) : null}
    </SettingsPage>
  );
}

/** The balance counts up to its figure on arrival, the way the numbers on Your
    activity do, so a returning total isn't simply swapped for a new one. */
function Counter({ value }: { value: number }) {
  const shown = useCountUp(value);
  return <>{shown}</>;
}
