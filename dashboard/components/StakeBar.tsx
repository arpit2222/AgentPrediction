interface Props {
  yesAmount: string;
  noAmount: string;
  className?: string;
}

export default function StakeBar({ yesAmount, noAmount, className = '' }: Props) {
  const yes = parseFloat(yesAmount) || 0;
  const no = parseFloat(noAmount) || 0;
  const total = yes + no;
  const yesPct = total === 0 ? 50 : Math.round((yes / total) * 100);
  const noPct = 100 - yesPct;

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex h-2 overflow-hidden rounded-full bg-gray-800">
        <div
          className="bg-yes transition-all duration-700"
          style={{ width: `${yesPct}%` }}
        />
        <div
          className="bg-no transition-all duration-700"
          style={{ width: `${noPct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span className="text-yes">{yesPct}% YES · {yes.toLocaleString()} USDC</span>
        <span className="text-no">{noPct}% NO · {no.toLocaleString()} USDC</span>
      </div>
    </div>
  );
}
