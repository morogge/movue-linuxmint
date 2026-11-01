import { SHORTCUTS } from '@shared/shortcuts';

export function ShortcutTable() {
  return (
    <table className="shortcut-table">
      <thead>
        <tr>
          <th scope="col">Taste</th>
          <th scope="col">Wirkung</th>
        </tr>
      </thead>
      <tbody>
        {SHORTCUTS.map((s) => (
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
  );
}
