interface Props {
  title:    string;
  value:    string | number;
  subtitle?: string;
  accent?:  boolean;
}

export default function StatsCard({ title, value, subtitle, accent }: Props) {
  return (
    <div className={`card ${accent ? 'border-brand-200 bg-brand-50' : ''}`}>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className={`text-3xl font-bold mt-1 ${accent ? 'text-brand-600' : 'text-gray-900'}`}>
        {value}
      </p>
      {subtitle && (
        <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
      )}
    </div>
  );
}
