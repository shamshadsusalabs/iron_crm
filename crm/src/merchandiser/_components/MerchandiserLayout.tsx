import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  FiGrid,  FiCalendar, 
  FiChevronLeft, FiMenu,
  FiLogOut, FiHelpCircle, FiUsers, FiLock,
  FiLayers, FiCheckCircle, FiPlus
} from 'react-icons/fi';
import merchAxios from '@/lib/merchAxios'
import MerchEmailSettingsModal from './MerchEmailSettingsModal'
import useMerchAuthStore from '@/store/useMerchAuthStore'

const MerchandiserLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [emailSettingsOpen, setEmailSettingsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useMerchAuthStore()
  const hasPermission = useMerchAuthStore((s) => s.hasPermission)
  const user = useMerchAuthStore((s) => s.user)

  // Close mobile sidebar when route changes
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location]);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const toggleMobileSidebar = () => {
    setMobileSidebarOpen(!mobileSidebarOpen);
  };

  const navLinks = [
    { name: 'Dashboard', icon: <FiGrid size={20} />, path: '/merchandiser/merchandiserDashboard' },
    { name: 'Lead', icon: <FiUsers size={20} />, path: '/merchandiser/lead', permissionKey: 'lead' },
    { name: 'Event Creation', icon: <FiCalendar size={20} />, path: '/merchandiser/event' },
    { name: 'Email', icon: <FiLayers size={20} />, path: '/merchandiser/email', permissionKey: 'email' },
    { name: 'Follow-ups', icon: <FiLayers size={20} />, path: '/merchandiser/follow-ups', permissionKey: 'followUp' },
    { name: 'Customer Enquiry', icon: <FiUsers size={20} />, path: '/merchandiser/customer-enquiries', permissionKey: 'customerEnquiry' },
    { name: 'Profiling', icon: <FiCheckCircle size={20} />, path: '/merchandiser/customer-profiling', permissionKey: 'customerProfiling' },
    { name: 'Tracking', icon: <FiCheckCircle size={20} />, path: '/merchandiser/tracking' },
    // Removed Catalog and Template from navigation
  ] as const;

  const visibleLinks = navLinks.filter((l: any) => {
    if (!('permissionKey' in l)) return true;
    return hasPermission(l.permissionKey as any);
  })

  const getPageTitle = () => {
    const currentLink = navLinks.find(link => link.path === location.pathname);
    return currentLink ? currentLink.name : 'Dashboard';
  };

  return (
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
              <h1 className="text-xl font-bold text-indigo-600">Merchandiser</h1>
            ) : (
              <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold">M</div>
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
                {visibleLinks.map((link) => (
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
              <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-medium">
                {(((user as any)?.name || (user as any)?.email || 'U') as string).trim().charAt(0).toUpperCase()}
              </div>
              {sidebarOpen && (
                <div className="ml-3 overflow-hidden">
                  <p className="text-sm font-medium text-gray-700 truncate">{(user as any)?.name || (user as any)?.email || 'User'}</p>
                  {(user as any)?.email && (
                    <p className="text-xs text-gray-500 truncate">{(user as any)?.email}</p>
                  )}
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
                <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-medium">
                  {((user?.email || 'u')[0] || 'U').toUpperCase()}
                </div>
                <span className="hidden text-sm font-medium text-gray-700 md:block truncate max-w-[160px]">
                  {user?.email || 'Merchandiser'}
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
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                  {/* <a
                    href="#"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <div className="flex items-center">
                      <FiUsers className="mr-2" size={16} />
                      Profile
                    </div>
                  </a> */}
                  {/* <a
                    href="#"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <div className="flex items-center">
                      <FiLock className="mr-2" size={16} />
                      Change Password
                    </div>
                  </a> */}
                  {/* <a
                    href="#"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <div className="flex items-center">
                      <FiHelpCircle className="mr-2" size={16} />
                      Help
                    </div>
                  </a> */}
                  <button
                    onClick={() => { setEmailSettingsOpen(true); setUserDropdownOpen(false) }}
                    className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <div className="flex items-center">
                      <FiLayers className="mr-2" size={16} />
                      Email Settings
                    </div>
                  </button>
                  <div className="border-t border-gray-200 my-1"></div>
                  <button
                    onClick={async () => {
                      try { await merchAxios.post('/logout') } catch {}
                      try {
                        localStorage.clear();
                        sessionStorage.clear();
                        if (typeof document !== 'undefined') {
                          document.cookie.split(';').forEach((c) => {
                            const name = c.split('=')[0]?.trim();
                            if (name) document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
                          });
                        }
                      } catch {}
                      logout();
                      setUserDropdownOpen(false);
                      navigate('/merchandiser');
                    }}
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

      {/* Email Settings Modal */}
      {emailSettingsOpen && (
        <MerchEmailSettingsModal open={emailSettingsOpen} onClose={() => setEmailSettingsOpen(false)} />
      )}
    </div>
  );
};

export default MerchandiserLayout;