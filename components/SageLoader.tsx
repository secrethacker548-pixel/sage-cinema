import Image from 'next/image';

type SageLoaderProps = {
  label?: string;
  detail?: string;
};

export default function SageLoader({
  label = 'Tuning the projector',
  detail = 'Finding your next world',
}: SageLoaderProps) {
  return (
    <div className="sage-loader" role="status" aria-live="polite" aria-label={label}>
      <div className="sage-loader-mark" aria-hidden="true">
        <span className="sage-loader-sweep" />
        <Image src="/icon.svg" alt="" width={84} height={84} priority />
      </div>
      <div className="sage-loader-copy">
        <span>SAGE <b>CINEMA</b></span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </div>
      <span className="sage-loader-progress" aria-hidden="true"><i /></span>
    </div>
  );
}
