import { Markets } from "@/app/components/Markets";

export default function Home() {
  return (
    <main className="exchange-shell flex flex-col items-center justify-start p-12">
      <Markets />
    </main>
  );
}
