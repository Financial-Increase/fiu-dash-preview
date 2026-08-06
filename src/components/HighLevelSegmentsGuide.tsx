import { ExternalLink } from "lucide-react";

const HIGHLEVEL_SEGMENTS = [
  {
    name: "All",
    description: "Everyone in HighLevel.",
    url: "https://app.gohighlevel.com/v2/location/0wGj9IjNlSL307m4uy9Q/contacts/smart_list/all",
  },
  {
    name: "Marketing",
    description: "People who have never purchased Live or Velocity and are not currently in a Live upsell sequence.",
    url: "https://app.gohighlevel.com/v2/location/0wGj9IjNlSL307m4uy9Q/contacts/smart_list/AqF2ShVd0LVztDPzTEoK",
  },
  {
    name: "Messengers",
    description: "Affiliates.",
    url: "https://app.gohighlevel.com/v2/location/0wGj9IjNlSL307m4uy9Q/contacts/smart_list/Gqm3SOxtXzM5szidvYfu",
  },
  {
    name: "Live Active",
    description: "Current paying members of the Live Membership.",
    url: "https://app.gohighlevel.com/v2/location/0wGj9IjNlSL307m4uy9Q/contacts/smart_list/Oj29qGIAiJ55eaqGYivR",
  },
  {
    name: "Live Canceled",
    description: "Former Live members who are no longer paying customers.",
    url: "https://app.gohighlevel.com/v2/location/0wGj9IjNlSL307m4uy9Q/contacts/smart_list/T86sCsfb8bltKfr2HCS2",
  },
  {
    name: "Velocity Active",
    description: "Current paying customers of Velocity.",
    url: "https://app.gohighlevel.com/v2/location/0wGj9IjNlSL307m4uy9Q/contacts/smart_list/rodD1v5BDQrjXRsST8sq",
  },
  {
    name: "Velocity Canceled",
    description: "Customers who canceled before completing their agreed payment plan.",
    url: "https://app.gohighlevel.com/v2/location/0wGj9IjNlSL307m4uy9Q/contacts/smart_list/u3o3C59n7eMDRna4B87e",
  },
  {
    name: "Velocity Completed",
    description: "Customers who completed all Velocity payments and whose program term has ended.",
    url: "https://app.gohighlevel.com/v2/location/0wGj9IjNlSL307m4uy9Q/contacts/smart_list/N9C6Z1RpFsOcOIIpUkOE",
  },
] as const;

export default function HighLevelSegmentsGuide() {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">HighLevel Smart Lists</h3>
        <p className="mt-0.5 text-xs text-steel">
          Choose one of these smart list segments when selecting recipients for emails in GHL.
        </p>
      </div>

      <div className="grid grid-cols-2 items-stretch gap-2 sm:grid-cols-4 xl:grid-cols-8">
        {HIGHLEVEL_SEGMENTS.map((segment) => (
          <div
            key={segment.name}
            className="relative h-full min-h-28 min-w-0 rounded-md border border-border bg-card p-3"
          >
            <div className="min-w-0 pr-5">
              <p className="min-w-0 text-sm font-semibold leading-tight text-foreground">{segment.name}</p>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-steel">{segment.description}</p>
            <a
              href={segment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute right-2.5 top-2.5 rounded-sm p-0.5 text-steel transition-colors hover:bg-gold/10 hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              aria-label={`Open ${segment.name} Smart List in HighLevel`}
              title={`Open ${segment.name} in HighLevel`}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
