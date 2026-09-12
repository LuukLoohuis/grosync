import { toast } from 'sonner';

const EXPLANATION = 'Deze hoeveelheid is geschat uit de video. Kijk hem even na.';

const EstimateBadge = () => (
  <button
    type="button"
    onClick={() => toast(EXPLANATION)}
    title={EXPLANATION}
    className="ml-1.5 inline-flex items-center rounded-md bg-muted px-[7px] py-1 align-middle text-xs font-semibold leading-none text-foreground/80"
  >
    geschat
  </button>
);

export default EstimateBadge;
