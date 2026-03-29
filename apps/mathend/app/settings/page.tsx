import Link from "next/link";

export default function SettingsPage() {
  return (
    <main className="settings-page">
      <section className="settings-panel">
        <h1 className="settings-title">Settings</h1>
        <p className="settings-subtitle">
          Atur preferensi aplikasi untuk pengalaman menulis yang lebih nyaman.
        </p>

        <div className="settings-list">
          <div className="settings-row">
            <span className="settings-label">Auto-save notes</span>
            <span className="settings-value">Aktif</span>
          </div>
          <div className="settings-row">
            <span className="settings-label">Math command popover</span>
            <span className="settings-value">Aktif</span>
          </div>
          <div className="settings-row">
            <span className="settings-label">Sidebar mode</span>
            <span className="settings-value">Sesuai pilihan terakhir</span>
          </div>
        </div>

        <Link href="/" className="settings-back-link">
          Kembali ke Notes
        </Link>
      </section>
    </main>
  );
}
