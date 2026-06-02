import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import TaskCard from '../components/TaskCard';

// мокаем API задач — не делаем реальных HTTP запросов
vi.mock('../api/tasks', () => ({
  updateTask: vi.fn(),
  moveTask: vi.fn(),
  deleteTask: vi.fn(),
  undoTask: vi.fn(),
}));

// базовые пропсы для карточки
const baseProps = {
  projectId: 1,
  onUpdate: vi.fn(),
  onDelete: vi.fn(),
};

describe('TaskCard компонент', () => {
  test('отображает заголовок задачи', () => {
    render(
      <TaskCard
        {...baseProps}
        task={{ id: 1, title: 'Тестовая задача', description: '', column: 'in_progress' }}
      />
    );

    expect(screen.getByText('Тестовая задача')).toBeInTheDocument();
  });

  test('отображает описание если оно есть', () => {
    render(
      <TaskCard
        {...baseProps}
        task={{ id: 1, title: 'Задача', description: 'Описание задачи', column: 'in_progress' }}
      />
    );

    expect(screen.getByText('Описание задачи')).toBeInTheDocument();
  });

  test('кнопка влево отключена для первой колонки (todo)', () => {
    render(
      <TaskCard
        {...baseProps}
        task={{ id: 1, title: 'Задача', description: '', column: 'todo' }}
      />
    );

    // первая кнопка — стрелка влево
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toBeDisabled();
    // стрелка вправо должна быть активна
    expect(buttons[1]).not.toBeDisabled();
  });

  test('кнопка вправо отключена для последней колонки (done)', () => {
    render(
      <TaskCard
        {...baseProps}
        task={{ id: 1, title: 'Задача', description: '', column: 'done' }}
      />
    );

    const buttons = screen.getAllByRole('button');
    // стрелка влево активна
    expect(buttons[0]).not.toBeDisabled();
    // стрелка вправо отключена
    expect(buttons[1]).toBeDisabled();
  });

  test('обе кнопки активны для средней колонки (in_progress)', () => {
    render(
      <TaskCard
        {...baseProps}
        task={{ id: 1, title: 'Задача', description: '', column: 'in_progress' }}
      />
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).not.toBeDisabled();
    expect(buttons[1]).not.toBeDisabled();
  });

  test('отображает кнопки управления задачей', () => {
    render(
      <TaskCard
        {...baseProps}
        task={{ id: 1, title: 'Задача', description: '', column: 'todo' }}
      />
    );

    expect(screen.getByRole('button', { name: /изменить/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /удалить/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /отменить/i })).toBeInTheDocument();
  });
});
