import { useId, useState } from 'react';
import { ArrowUpRight, FileText, Search, Users } from 'lucide-react';
import { labelFor } from '../lib/status';
import { Modal } from './ui';

export function CommandSearch({ items, students, applications, onNavigate, onClose }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const resultsId = useId();
  const normalized = query.trim().toLowerCase();
  const studentsById = new Map(students.map((student) => [student.id, student]));
  const pageResults = items.filter((item) => item.label.toLowerCase().includes(normalized)).map((item) => ({
    id: `page-${item.id}`, label: item.label, detail: 'Open workspace page', icon: item.icon, page: item.id, group: 'Pages',
  }));
  const studentResults = normalized ? students.filter((student) => (
    `${student.first_name} ${student.last_name} ${student.email || ''} ${student.student_code || ''}`.toLowerCase().includes(normalized)
  )).slice(0, 5).map((student) => ({
    id: `student-${student.id}`, label: `${student.first_name} ${student.last_name}`, detail: student.email || student.student_code || 'Student file',
    icon: Users, page: 'students', options: { studentId: student.id }, group: 'Students',
  })) : [];
  const applicationResults = normalized ? applications.filter((application) => {
    const student = studentsById.get(application.student_id);
    return `${student?.first_name || ''} ${student?.last_name || ''} ${application.university || ''} ${application.course || ''}`.toLowerCase().includes(normalized);
  }).slice(0, 5).map((application) => {
    const student = studentsById.get(application.student_id);
    return {
      id: `application-${application.id}`,
      label: `${student ? `${student.first_name} ${student.last_name}` : 'Student file'} · ${application.university || 'Application'}`,
      detail: `${application.course || 'Application'} · ${labelFor(application.status)}`,
      icon: FileText, page: 'applications', options: { applicationId: application.id }, group: 'Applications',
    };
  }) : [];
  const results = [...pageResults, ...studentResults, ...applicationResults];
  const activeIndex = Math.min(selectedIndex, Math.max(0, results.length - 1));

  function choose(result) {
    onClose();
    onNavigate(result.page, result.options);
  }

  function handleKeyDown(event) {
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && results.length) {
      event.preventDefault();
      const next = (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
      setSelectedIndex(next);
      document.getElementById(`${resultsId}-${next}`)?.scrollIntoView({ block: 'nearest' });
    }
    if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault();
      choose(results[activeIndex]);
    }
  }

  return (
    <Modal title="Search your workspace" description="Find students, applications, or jump to a page." open onClose={onClose} className="command-modal">
      <div className="command-search">
        <Search size={20} aria-hidden="true" />
        <input
          data-autofocus
          type="search"
          placeholder="Search by name, university, or page…"
          aria-label="Search students, applications, and pages"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="true"
          aria-controls={resultsId}
          aria-activedescendant={results.length ? `${resultsId}-${activeIndex}` : undefined}
          value={query}
          onChange={(event) => { setQuery(event.target.value); setSelectedIndex(0); }}
          onKeyDown={handleKeyDown}
        />
      </div>
      <div className="command-results" id={resultsId} role="listbox" aria-label="Search results">
        {results.map((result, index) => {
          const Icon = result.icon;
          return (
            <div key={result.id} role="presentation">
              {index === 0 || results[index - 1].group !== result.group ? <p className="command-group-label" role="presentation">{result.group}</p> : null}
              <button
                id={`${resultsId}-${index}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                tabIndex={-1}
                className={`command-result${index === activeIndex ? ' is-selected' : ''}`}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => choose(result)}
              >
                <span className="command-result-icon"><Icon size={18} aria-hidden="true" /></span>
                <span className="command-result-copy"><strong>{result.label}</strong><small>{result.detail}</small></span>
                <ArrowUpRight size={16} aria-hidden="true" />
              </button>
            </div>
          );
        })}
        {!results.length ? <div className="command-empty"><Search size={26} /><strong>No matches for “{query}”</strong><p>Try a student name, university, or page such as Tasks.</p></div> : null}
      </div>
      <div className="command-footer"><span><kbd>↑</kbd> <kbd>↓</kbd> to navigate</span><span><kbd>Enter</kbd> to open</span><span><kbd>Esc</kbd> to close</span></div>
    </Modal>
  );
}
