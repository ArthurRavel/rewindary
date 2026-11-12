import { useState } from 'preact/hooks';
import { REMIND_DAYS, appAddress, reminderFileName, reminderIcs, reminderLabel, reminderStart, type RemindDays } from '../reminder';
import { download } from './download';
import { Icon } from './Icon';

const CHOICE: Record<RemindDays, string> = { 3: '3 days', 7: '1 week', 30: '30 days' };

/** "Requested an export?": downloads a calendar reminder made on this device, so the visitor can come back when it arrives. */
export function Reminder() {
  const [days, setDays] = useState<RemindDays>(7);
  const [saved, setSaved] = useState<string | null>(null);
  const label = reminderLabel(reminderStart(new Date(), days));
  const choose = (d: RemindDays) => { setDays(d); setSaved(null); };
  const save = () => {
    const now = new Date();
    const uid = `${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 10)}@rewindary`;
    const ics = reminderIcs({ now, days, url: appAddress(location), uid });
    const name = reminderFileName(now, days);
    download(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), name);
    setSaved(name);
  };
  return (
    <section class="remind" aria-labelledby="remind-title" data-testid="reminder">
      <h3 id="remind-title">Requested an export?</h3>
      <p class="fine">Most take days to arrive. Put a reminder in your calendar to come back when yours is ready.</p>
      <div class="remind-row">
        <span class="remind-in" aria-hidden="true">Remind me in</span>
        <div class="seg" role="group" aria-label="Remind me in">
          {REMIND_DAYS.map((d) => <button key={d} aria-pressed={days === d} onClick={() => choose(d)}>{CHOICE[d]}</button>)}
        </div>
        <button class="ghost" onClick={save} data-testid="add-reminder"><Icon name="calendar" size={18} />Add to calendar</button>
      </div>
      <p class="remind-note" role="status" data-testid="reminder-note">
        {saved
          ? <>Saved <code>{saved}</code>. Open it to add {label} to your calendar.</>
          : <>{label}, with an alert. The .ics file holds a title, that time and this page's address, nothing from your exports. It is made on this device and nothing is sent.</>}
      </p>
    </section>
  );
}
