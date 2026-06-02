import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import Login from '../pages/Login';

// мокаем axios клиент — не делаем реальных HTTP запросов
vi.mock('../api/client', () => ({
  default: {
    post: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

// мокаем контекст авторизации
const mockLogin = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
  }),
}));

// мокаем роутер — нет реального браузерного history
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }) => <a href={to}>{children}</a>,
}));

import client from '../api/client';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Login страница', () => {
  test('рендерит заголовок и кнопку входа', () => {
    render(<Login />);

    expect(screen.getByRole('heading', { name: /вход/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /войти/i })).toBeInTheDocument();
  });

  test('рендерит поля email и пароль', () => {
    const { container } = render(<Login />);

    const emailInput = container.querySelector('input[type="email"]');
    const passwordInput = container.querySelector('input[type="password"]');

    expect(emailInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
  });

  test('рендерит ссылку на регистрацию', () => {
    render(<Login />);

    expect(screen.getByRole('link', { name: /зарегистрироваться/i })).toBeInTheDocument();
  });

  test('submit вызывает login API с введёнными данными', async () => {
    client.post.mockResolvedValue({ data: { token: 'test-token' } });

    const { container } = render(<Login />);

    const emailInput = container.querySelector('input[type="email"]');
    const passwordInput = container.querySelector('input[type="password"]');

    fireEvent.change(emailInput, { target: { value: 'user@test.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /войти/i }));

    await waitFor(() => {
      expect(client.post).toHaveBeenCalledWith('/api/auth/login', {
        email: 'user@test.com',
        password: 'password123',
      });
    });
  });

  test('успешный вход сохраняет токен и редиректит', async () => {
    client.post.mockResolvedValue({ data: { token: 'test-token' } });

    const { container } = render(<Login />);

    fireEvent.change(container.querySelector('input[type="email"]'), {
      target: { value: 'user@test.com' },
    });
    fireEvent.change(container.querySelector('input[type="password"]'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /войти/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test-token');
      expect(mockNavigate).toHaveBeenCalledWith('/projects');
    });
  });

  test('ошибка API показывает сообщение об ошибке', async () => {
    client.post.mockRejectedValue({
      response: { data: { error: 'Неверный email или пароль' } },
    });

    const { container } = render(<Login />);

    fireEvent.change(container.querySelector('input[type="email"]'), {
      target: { value: 'user@test.com' },
    });
    fireEvent.change(container.querySelector('input[type="password"]'), {
      target: { value: 'wrong' },
    });
    fireEvent.click(screen.getByRole('button', { name: /войти/i }));

    await waitFor(() => {
      expect(screen.getByText(/Неверный email или пароль/)).toBeInTheDocument();
    });
  });
});
