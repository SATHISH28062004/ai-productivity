import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import api from './api';
import CategoryChart from './components/CategoryChart';

// --- Auth Components (Simple Implementation) ---

const AuthForm = ({ isSignup }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const endpoint = isSignup ? '/auth/signup' : '/auth/login';
      const res = await api.post(endpoint, { email, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      navigate('/tasks');
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed');
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '5px' }}>
      <h2>{isSignup ? 'Sign Up' : 'Login'}</h2>
      <form onSubmit={handleSubmit}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required style={{ width: '100%', padding: '10px', margin: '10px 0' }} />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required style={{ width: '100%', padding: '10px', margin: '10px 0' }} />
        <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '3px' }}>
          {isSignup ? 'Sign Up' : 'Login'}
        </button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <p>
        {isSignup ? 'Already have an account? ' : "Don't have an account? "}
        <Link to={isSignup ? '/login' : '/signup'}>{isSignup ? 'Login' : 'Sign Up'}</Link>
      </p>
    </div>
  );
};

const SignupPage = () => <AuthForm isSignup={true} />;
const LoginPage = () => <AuthForm isSignup={false} />;

// --- Task CRUD Component ---

const TasksPage = () => {
  // ✅ CORRECT PLACEMENT: All Hooks are called inside the TasksPage component
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeProcedure, setActiveProcedure] = useState(null); // New State
  const navigate = useNavigate();

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await api.get('/tasks');
      setTasks(res.data);
    } catch (err) {
      if (err.response && err.response.status === 401) {
        localStorage.removeItem('token');
        navigate('/login');
      }
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (localStorage.getItem('token')) {
      fetchTasks();
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/tasks', { title, description, due_date: dueDate || null });
      setTasks([...tasks, res.data]);
      setTitle('');
      setDescription('');
      setDueDate('');
      alert(`Task created. AI categorized it as **${res.data.category}** with **${res.data.priority}** priority.`);
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  const toggleComplete = async (task) => {
    try {
      const res = await api.put(`/tasks/${task.id}`, { completed: !task.completed });
      setTasks(tasks.map(t => (t.id === task.id ? res.data : t)));
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await api.delete(`/tasks/${id}`);
        setTasks(tasks.filter(t => t.id !== id));
      } catch (err) {
        console.error('Failed to delete task:', err);
      }
    }
  };

  const runPrediction = async (id) => {
    try {
      const res = await api.post(`/tasks/${id}/predict-time`);
      alert(`AI predicted time to complete: ${res.data.estimate} hours.`);
      fetchTasks(); // Refresh list to show estimated time
    } catch (err) {
      alert('Prediction failed. Check your OpenAI API key/usage.');
      console.error('Prediction error:', err);
    }
  };
  
  // NEW FUNCTION: Generate Step-by-Step Procedure
  const generateTaskProcedure = async (task) => {
      try {
          setActiveProcedure({ id: task.id, loading: true, content: null });
          const res = await api.post(`/tasks/${task.id}/generate-procedure`);
          
          setActiveProcedure({ 
              id: task.id, 
              loading: false, 
              content: res.data.procedure 
          });
      } catch (err) {
          alert('Failed to generate procedure. Check API logs and server.');
          setActiveProcedure(null);
          console.error('Procedure generation error:', err);
      }
  };


  if (loading) return <div>Loading tasks...</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h1>My AI-Tasks</h1>
      <CategoryChart tasks={tasks} />

      <div style={{ marginTop: '20px', border: '1px solid #ddd', padding: '15px', borderRadius: '5px' }}>
        <h3>Create New Task (AI will suggest category & priority)</h3>
        <form onSubmit={handleSubmit}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" required style={{ width: '100%', padding: '8px', margin: '5px 0' }} />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" style={{ width: '100%', padding: '8px', margin: '5px 0' }} />
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ width: '100%', padding: '8px', margin: '5px 0' }} />
          <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '3px' }}>
            Add Task
          </button>
        </form>
      </div>

      <div style={{ marginTop: '30px' }}>
        <h3>Task List</h3>
        <ul style={{ listStyleType: 'none', padding: 0 }}>
          {tasks.map(task => (
            <li key={task.id} style={{ border: '1px solid #eee', padding: '10px', margin: '10px 0', backgroundColor: task.completed ? '#e9f7ef' : 'white' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ textDecoration: task.completed ? 'line-through' : 'none', fontWeight: 'bold' }}>
                  {task.title}
                </span>
                <div>
                  <button onClick={() => toggleComplete(task)} style={{ marginRight: '10px', backgroundColor: task.completed ? '#dc3545' : '#17a2b8', color: 'white' }}>
                    {task.completed ? 'Undo' : 'Complete'}
                  </button>
                  {/* NEW BUTTON */}
                  <button onClick={() => generateTaskProcedure(task)} style={{ marginRight: '10px', backgroundColor: '#007bff', color: 'white' }}>
                    Generate Steps 💡
                  </button>
                  {/* --- */}
                  <button onClick={() => handleDelete(task.id)} style={{ backgroundColor: '#ffc107', color: 'black' }}>
                    Delete
                  </button>
                </div>
              </div>
              <p style={{ margin: '5px 0' }}>{task.description}</p>
              <p style={{ fontSize: '0.9em' }}>
                **Category:** {task.category} | **Priority:** {task.priority} | **Due:** {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'N/A'}
              </p>
              <p style={{ fontSize: '0.9em', color: '#6c757d' }}>
                **Est. Time:** {task.estimated_time_hours ? `${task.estimated_time_hours} hours` :
                  <button onClick={() => runPrediction(task.id)} style={{ marginLeft: '5px', padding: '2px 5px', fontSize: '0.8em' }}>Predict Time</button>}
              </p>

              {/* NEW PROCEDURE DISPLAY */}
              {activeProcedure && activeProcedure.id === task.id && (
                <div style={{ marginTop: '10px', padding: '10px', borderTop: '1px dashed #ccc' }}>
                  <h4>AI Procedure:</h4>
                  {activeProcedure.loading ? (
                    <p>AI is thinking...</p>
                  ) : (
                    <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{activeProcedure.content}</pre>
                  )}
                </div>
              )}
              {/* --- */}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};


// --- App Structure ---

const Header = () => {
  const navigate = useNavigate();
  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };
  return (
    <header style={{ padding: '10px 20px', backgroundColor: '#333', color: 'white', display: 'flex', justifyContent: 'space-between' }}>
      <h2>AI Task Manager</h2>
      <nav>
        {localStorage.getItem('token') && (
          <button onClick={handleLogout} style={{ backgroundColor: 'transparent', color: 'white', border: '1px solid white', padding: '5px 10px', cursor: 'pointer' }}>
            Logout
          </button>
        )}
      </nav>
    </header>
  );
};


function App() {
  return (
    <Router>
      <Header />
      <Routes>
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/" element={localStorage.getItem('token') ? <TasksPage /> : <LoginPage />} />
      </Routes>
    </Router>
  );
}

export default App;