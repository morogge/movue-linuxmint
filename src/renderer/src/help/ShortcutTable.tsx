import { BEREICH_NAME, SHORTCUTS, type Bereich } from '@shared/shortcuts';

export function ShortcutTable() {
  const bereiche: Bereich[] = ['app', 'player'];
  return (
    <>
      {bereiche.map((b) => (
        <table key={b} className="shortcut-table">
          <caption>{BEREICH_NAME[b]}</caption>
          <thead>
            <tr>
              <th scope="col">Taste</th>
              <th scope="col">Wirkung</th>
            </tr>
          </thead>
          <tbody>
            {SHORTCUTS.filter((s) => (s.bereich ?? 'app') === b).map((s) => (
              <tr key={s.id}>
                <td>
                  {s.keys.map((k, i) => (
                    <span key={k}>
                      {i > 0 && ' + '}
                      <kbd>{k}</kbd>
                    </span>
                  ))}
                </td>
                <td>{s.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </>
  );
}
