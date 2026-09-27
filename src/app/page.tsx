import { CreateTripForm } from "@/components/CreateTripForm";

const STEPS = [
  { icon: "🔗", title: "One link for everyone", body: "Each person spends 3 minutes on budget, dates, dealbreakers and what they love. No more polls." },
  { icon: "🔎", title: "3 trips that fit the group", body: "AI searches Google for real prices and travel times, then scores every option for every person." },
  { icon: "🤝", title: "Nobody gets left behind", body: "If someone can't make it, you get concrete ways to bring them along, and everyone votes on them." },
];

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="space-y-3 pt-2">
        <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-stone-900 sm:text-5xl">
          1,200 messages. Zero plans. <span className="text-orange-500">Let&apos;s fix that.</span>
        </h1>
        <p className="text-lg text-stone-600">
          Everyone fills in one link. You get the 3 trips that work best for the whole group, where each person stands on
          each one, and a plan for anyone who&apos;d miss out.
        </p>
      </section>
      <ol className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((s) => (
          <li key={s.title} className="rounded-3xl bg-white p-4 shadow-sm">
            <span className="text-2xl" aria-hidden>{s.icon}</span>
            <p className="mt-1 font-display font-bold text-stone-900">{s.title}</p>
            <p className="mt-1 text-sm text-stone-600">{s.body}</p>
          </li>
        ))}
      </ol>
      <CreateTripForm />
    </div>
  );
}
