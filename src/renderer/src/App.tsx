const placeholderAccounts = ['All inboxes']

function App(): React.JSX.Element {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          Ember Mail
        </div>
        <nav>
          {placeholderAccounts.map((name) => (
            <div key={name} className="nav-item active">
              {name}
            </div>
          ))}
        </nav>
        <button className="add-account" disabled>
          + Add account
        </button>
      </aside>

      <section className="message-list">
        <header className="pane-header">Inbox</header>
        <div className="empty">No accounts yet. Account setup arrives in v1.</div>
      </section>

      <main className="reader">
        <div className="empty">Select a message to read it here.</div>
      </main>
    </div>
  )
}

export default App
