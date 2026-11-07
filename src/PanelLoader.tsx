export default function PanelLoader({ label }: { label: string }) {
  return (
    <div className="panel-loader" role="status">
      <div className="panel-loader__pulse" aria-hidden="true" />
      <p>{label}</p>
    </div>
  )
}
