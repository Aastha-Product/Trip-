import { CreateTripForm } from "@/components/CreateTripForm";

const STEPS = [
  { icon: "🔗", text: "Share one link in your group" },
  { icon: "✍️", text: "Friends add preferences in 1 min" },
  { icon: "✨", text: "Get trips that fit everyone" },
];

export default function Home() {
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-700 via-indigo-700 to-indigo-900 p-6 text-white shadow-xl shadow-indigo-900/20 sm:p-8">
        <div aria-hidden className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-fuchsia-400/30 blur-2xl" />
        <div aria-hidden className="absolute -bottom-16 left-10 h-40 w-40 rounded-full bg-sky-400/20 blur-2xl" />
        <p className="relative text-sm font-semibold uppercase tracking-widest text-violet-200">Group trip planner</p>
        <h1 className="relative mt-2 font-display text-4xl font-extrabold leading-[1.05] sm:text-5xl">
          The trip your group keeps talking about. <span className="text-fuchsia-300">Finally planned.</span>
        </h1>
        <ul className="relative mt-6 grid gap-2 sm:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.text} className="flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2.5 text-sm backdrop-blur">
              <span aria-hidden className="text-lg">{s.icon}</span>
              {s.text}
            </li>
          ))}
        </ul>
      </section>
      <CreateTripForm />
    </div>
  );
}
