interface Props {
  title: string
  message?: string
}

export default function ErrorScreen({ title, message = 'Please try again later.' }: Props) {
  return (
    <main className="p-8 flex flex-col items-center gap-2">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-muted-foreground">{message}</p>
    </main>
  );
}
