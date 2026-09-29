import { appConfig } from "@workspace-template/data";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="font-semibold text-brand-600 text-sm uppercase tracking-wide">
        Howard agent workspace
      </p>
      <h1 className="mt-4 font-bold text-4xl tracking-tight">
        {appConfig.name}
      </h1>
      <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
        {appConfig.description}
      </p>
      <div className="mt-8 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <p className="font-medium">Included stack</p>
        <ul className="mt-2 list-inside list-disc text-slate-600 dark:text-slate-300">
          <li>Bun + Turborepo + TypeScript</li>
          <li>Next.js + Tailwind CSS</li>
          <li>Prisma + Postgres + Better Auth-ready schema</li>
          <li>Ultracite/Biome, Husky, Gitleaks, Typos, Dependabot, CI</li>
        </ul>
      </div>
    </main>
  );
}
