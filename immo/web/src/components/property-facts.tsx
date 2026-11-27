import type { Formatters, Messages } from "@/i18n";
import type { PublicProperty } from "@/lib/data/matching";

/** Customer-safe facts of a listing; used wherever a listing is shown outside its own office. */
export function PublicFacts({ property: p, m, f }: { property: PublicProperty; m: Messages; f: Formatters }) {
  const t = m.property;
  const facts: [string, string | null][] = [
    [t.propertyType, m.enums.propertyType[p.propertyType]],
    [t.dealType, m.enums.dealType[p.dealType]],
    [t.location, [p.city, p.district].filter(Boolean).join(", ")],
    [t.area, p.areaSqm != null ? f.area(p.areaSqm) : null],
    [t.roomsDisplay, p.rooms != null ? f.rooms(p.rooms, p.livingRooms) : null],
    [t.bathrooms, p.bathrooms != null ? String(p.bathrooms) : null],
    [t.floor, p.floor != null ? String(p.floor) : null],
    [t.yearBuilt, p.yearBuilt != null ? String(p.yearBuilt) : null],
  ];
  return (
    <>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
        {facts.filter(([, value]) => value !== null).map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="mt-0.5 font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {p.description ? <p className="mt-4 text-sm whitespace-pre-line">{p.description}</p> : null}
    </>
  );
}
