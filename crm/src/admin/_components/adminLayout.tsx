import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  FiGrid, FiUsers, FiMessageSquare, FiUser, FiSettings, 
  FiChevronLeft, FiMenu,
  FiLogOut, FiHelpCircle, FiDatabase, FiUpload,
  FiActivity, FiMail, FiLock,
  FiLayers
} from 'react-icons/fi';
import axiosInstance from '@/lib/axiosInstance'
import AdminEmailSettingsModal from './AdminEmailSettingsModal'
import useAuthStore from '@/store/useAuthStore'

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [emailSettingsOpen, setEmailSettingsOpen] = useState(false);
  const [admin, setAdmin] = useState<{ name?: string; email?: string; role?: string; lastLogin?: string } | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Helpers (must come after state declarations)
  const { logout } = useAuthStore()

  // Close mobile sidebar when route changes
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data } = await axiosInstance.get('/profile')
        setAdmin({
          name: data?.name,
          email: data?.email,
          role: data?.role,
          lastLogin: data?.lastLogin,
        })
      } catch (e) {
        // ignore; user may be unauthenticated here
      }
    }
    loadProfile()
  }, [])

  const initials = (full?: string) => {
    if (!full) return 'AU'
    const parts = full.trim().split(/\s+/)
    const first = parts[0]?.[0] || ''
    const second = parts[1]?.[0] || ''
    return (first + second || first).toUpperCase()
  }

  const handleLogout = async () => {
    try {
      await axiosInstance.post('/logout')
    } catch {}
    // Clear storages and cookies
    try {
      localStorage.clear();
      sessionStorage.clear();
      if (typeof document !== 'undefined') {
        document.cookie.split(';').forEach((c) => {
          const name = c.split('=')[0]?.trim();
          if (name) {
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
          }
        });
      }
    } catch {}
    logout();
    setUserDropdownOpen(false);
    navigate('/');
  }

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const toggleMobileSidebar = () => {
    setMobileSidebarOpen(!mobileSidebarOpen);
  };

  const navLinks = [
    { name: 'Dashboard', icon: <FiGrid size={20} />, path: '/admin' },
    { name: 'User Management', icon: <FiUsers size={20} />, path: '/admin/User-Management' },
    { name: 'Customer Profiles', icon: <FiUser size={20} />, path: '/admin/Customer-Profile-Management' },
    { name: 'Customer Enquiry', icon: <FiMessageSquare size={20} />, path: '/admin/Customer-Enquiry-Mangement' },


    // { name: 'Template Upload', icon: <FiUpload size={20} />, path: '/admin/template-Upload' },
    { name: 'Access Control', icon: <FiLock size={20} />, path: '/admin/access-Control' },
    { name: 'Reports', icon: <FiActivity size={20} />, path: '/admin/reporting' },
    { name: 'Email', icon: <FiMail size={20} />, path: '/admin/gmaillayout' },
    { name: 'Follow-ups', icon: <FiMessageSquare size={20} />, path: '/admin/follow-ups' },
    // { name: 'Content', icon: <FiLayers size={20} />, path: '/admin/content' },
    // { name: 'Database', icon: <FiDatabase size={20} />, path: '/admin/database' },
    { name: 'Settings', icon: <FiSettings size={20} />, path: '/admin/settings' },
    { name: 'Tracking', icon: <FiSettings size={20} />, path: '/admin/tracking' },
  ];

  const getPageTitle = () => {
    const currentLink = navLinks.find(link => link.path === location.pathname);
    return currentLink ? currentLink.name : 'Dashboard';
  };

  return (
    <>
      <div className="flex h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={toggleMobileSidebar}
        ></div>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed z-30 h-screen bg-white shadow-lg transition-all duration-300 ease-in-out lg:relative ${
          sidebarOpen ? 'w-64' : 'w-20'
        } ${mobileSidebarOpen ? 'left-0' : '-left-full lg:left-0'}`}
      >
        <div className="flex h-full flex-col border-r border-gray-200">
          {/* Sidebar header */}
          <div className="flex h-16 items-center justify-between px-4">
            {sidebarOpen ? (
              <h1 className="text-xl font-bold text-indigo-600">AdminPro</h1>
            ) : (
              <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold">AP</div>
            )}
            <button
              onClick={toggleSidebar}
              className="hidden rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:block"
              aria-label="Toggle sidebar"
            >
              <FiChevronLeft size={20} className={`transition-transform ${sidebarOpen ? '' : 'rotate-180'}`} />
            </button>
          </div>

          {/* Sidebar content */}
          <div className="flex-1 overflow-y-auto">
            <nav className="px-2 py-4">
              <ul className="space-y-1">
                {navLinks.map((link) => (
                  <li key={link.name}>
                    <Link
                      to={link.path}
                      className={`group flex items-center rounded-lg p-3 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 ${
                        location.pathname === link.path ? 'bg-indigo-50 text-indigo-600' : ''
                      }`}
                    >
                      <span className="flex items-center justify-center">
                        {link.icon}
                      </span>
                      {sidebarOpen && (
                        <span className="ml-3 font-medium">{link.name}</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/* Sidebar footer */}
          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center">
              <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-medium">{initials(admin?.name)}</div>
              {sidebarOpen && (
                <div className="ml-3 overflow-hidden">
                  <p className="text-sm font-medium text-gray-700 truncate">{admin?.name || '—'}</p>
                  <p className="text-xs text-gray-500 truncate">{admin?.email || '—'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Navbar */}
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4">
          <div className="flex items-center">
            <button
              onClick={toggleMobileSidebar}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
              aria-label="Open menu"
            >
              <FiMenu size={20} />
            </button>
            <h2 className="ml-4 text-lg font-semibold text-gray-800">
              {getPageTitle()}
            </h2>
          </div>

          <div className="flex items-center space-x-4">
            <div className="relative">
              <button 
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center space-x-2 focus:outline-none"
              >
                <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-medium">{initials(admin?.name)}</div>
                <span className="hidden text-sm font-medium text-gray-700 md:block">
                  {admin?.name || '—'}
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-gray-500"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                  <button
                    onClick={() => { setProfileOpen(true); setUserDropdownOpen(false) }}
                    className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <div className="flex items-center">
                      <FiUser className="mr-2" size={16} />
                      Profile
                    </div>
                  </button>
                  <button
                    onClick={() => { setEmailSettingsOpen(true); setUserDropdownOpen(false) }}
                    className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <div className="flex items-center">
                      <FiSettings className="mr-2" size={16} />
                      Email Settings
                    </div>
                  </button>
                  <div className="border-t border-gray-200 my-1"></div>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left block px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                  >
                    <div className="flex items-center">
                      <FiLogOut className="mr-2" size={16} />
                      Sign out
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 md:p-6">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>

      {/* Profile Modal */}
      {profileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black bg-opacity-40" onClick={()=> setProfileOpen(false)}></div>
          <div className="relative z-10 w-96 rounded-lg bg-white shadow-xl border border-gray-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Profile</h3>
              <button onClick={()=> setProfileOpen(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold">{initials(admin?.name)}</div>
                <div>
                  <div className="text-sm font-medium text-gray-900">{admin?.name || '—'}</div>
                  <div className="text-sm text-gray-500">{admin?.email || '—'}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="col-span-1 text-gray-500">Role</div>
                <div className="col-span-2 text-gray-800">{admin?.role || 'admin'}</div>
                <div className="col-span-1 text-gray-500">Last Login</div>
                <div className="col-span-2 text-gray-800">{admin?.lastLogin ? new Date(admin.lastLogin).toLocaleString() : '—'}</div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button onClick={()=> setProfileOpen(false)} className="px-4 py-2 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Email Settings Modal */}
      {emailSettingsOpen && (
        <AdminEmailSettingsModal open={emailSettingsOpen} onClose={() => setEmailSettingsOpen(false)} />
      )}
    </>
  );
};

export default AdminLayout;