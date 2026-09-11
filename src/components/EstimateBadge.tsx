import { toast } from 'sonner';

const EXPLANATION = 'Deze hoeveelheid is geschat uit de video. Kijk hem even na.';

const EstimateBadge = () => (
  <button
    type="button"
    onClick={() => toast(EXPLANATION)}
    title={EXPLANATION}
    className="ml-1.5 inline-flex items-center rounded bg-[#FBE7C9] px-1.5 py-0.5 align-middle text-[11px] font-semibold leading-none text-[#7A4A06]"
  >
    geschat
  </button>
);

export default EstimateBadge;
