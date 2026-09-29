import { appConfig } from "@workspace-template/data";
import { Button } from "@workspace-template/ui/components/button";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <h1 className="font-heading text-5xl">{appConfig.name}</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        {appConfig.description}
      </p>
      <div className="mt-8">
        <Button size="lg">Add a recipe</Button>
      </div>
    </main>
  );
}
