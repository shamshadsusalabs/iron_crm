import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import Login from "./admin/login"; // Keep Login eager-loaded for faster auth load

// Lazy loaded components
const AdminLayout = lazy(() => import("./admin/_components/adminLayout"));
const Dashboard = lazy(() => import("./admin/_components/Dashboard"));
const CustomerEnquiryMangement = lazy(() =>
  import("./admin/_components/CustomerEnquiryMangement")
);
const UserManagement = lazy(() =>
  import("./admin/_components/UserManagement")
);
const CustomerProfileManagement = lazy(() =>
  import("./admin/_components/CustomerProfileManagement")
);
const TemplateUpload = lazy(() =>
  import("./admin/_components/TemplateUpload")
);
const AccessControl = lazy(() =>
  import("./admin/_components/AccessControl")
);
const Reporting = lazy(() =>
  import("./admin/_components/Reporting")
);
const Settings = lazy(() =>
  import("./admin/_components/Settings")
);
const AdminTracking = lazy(() =>
  import("./admin/_components/tracking")
);

const MerchandiserLayout = lazy(() =>
  import("./merchandiser/_components/MerchandiserLayout")
);
const MerchandiserDashboard = lazy(() =>
  import("./merchandiser/_components/MerchandiserDashboard")
);
const Event = lazy(() =>
  import("./merchandiser/_components/Event")
);
const Lead = lazy(() =>
  import("./merchandiser/_components/Lead")
);
const Gmaillayout = lazy(() =>
  import("./admin/_components/email/gmail-layout")
);
const FollowUpIndex = lazy(() =>
  import("./admin/_components/follow-up/index")
);
const MerchandiserRoot = lazy(() =>
  import("./merchandiser/_components/MerchandiserRoot")
);
const MerchCustomerEnquiries = lazy(() =>
  import("./merchandiser/_components/MerchCustomerEnquiries")
);
const MerchCustomerProfiling = lazy(() =>
  import("./merchandiser/_components/MerchCustomerProfiling")
);
const MerchTracking = lazy(() =>
  import("./merchandiser/_components/tracking")
);
export default function App() {
  return (
    <Suspense fallback={<div className="text-center mt-10">Loading...</div>}>
      <Routes>
        <Route path="/" element={<Login />} />

        {/* Admin Routes with layout */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="dashboard" />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route
            path="customer-enquiry-mangement"
            element={<CustomerEnquiryMangement />}
          />
          <Route path="user-management" element={<UserManagement />} />
          <Route
            path="customer-profile-management"
            element={<CustomerProfileManagement />}
          />
          <Route
            path="template-Upload"
            element={<TemplateUpload />}
          />
          <Route
            path="access-Control"
            element={<AccessControl />}
          />
          <Route
            path="reporting"
            element={<Reporting />}
          />
          <Route
            path="settings"
            element={<Settings />}
          />
            <Route
            path="tracking"
            element={<AdminTracking />}
          />
          <Route
            path="gmaillayout"
            element={<Gmaillayout />}
          />
          <Route
            path="follow-ups"
            element={<FollowUpIndex />}
          />
        </Route>

        <Route path="/merchandiser" element={<MerchandiserRoot />}>
          <Route element={<MerchandiserLayout />}>
            <Route index element={<Navigate to="merchandiserDashboard" />} />
            <Route path="merchandiserDashboard" element={<MerchandiserDashboard />} />
            <Route path="event" element={<Event />} />
            <Route path="lead" element={<Lead />} />
            <Route path="email" element={<Gmaillayout />} />
            <Route path="follow-ups" element={<FollowUpIndex />} />
            {/* Merch routes; enquiries and profiling reuse admin UIs via dynamic services */}
            <Route path="customer-enquiries" element={<CustomerEnquiryMangement />} />
            <Route path="customer-profiling" element={<CustomerProfileManagement />} />
            <Route path="tracking" element={<MerchTracking />} />
            
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
