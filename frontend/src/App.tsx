import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import AdminLayout from "./components/AdminLayout";
import AudioVisual from "./pages/AudioVisual";
import Timeline from "./pages/Timeline";
import ParkOverview from "./pages/ParkOverview";
import Login from "./pages/admin/Login";
import BrandList from "./pages/admin/BrandList";
import BrandEditor from "./pages/admin/BrandEditor";
import Projects from "./pages/admin/Projects";
import Preview from "./pages/admin/Preview";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./theme/ThemeProvider";
import { Toaster } from "react-hot-toast";

const App = () => {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <ThemeProvider>
          <Routes>
            {/* 管理控制台 */}
            <Route path="/admin/login" element={<Login />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/brands" replace />} />
              <Route path="brands" element={<BrandList />} />
              <Route path="brands/:id" element={<BrandEditor />} />
              <Route path="projects" element={<Projects />} />
              <Route path="preview" element={<Preview />} />
            </Route>
            {/* 公园站点（品牌主题消费者） */}
            <Route
              path="*"
              element={
                <Layout>
                  <Routes>
                    <Route path="/" element={<ParkOverview />} />
                    <Route path="/audiovisual" element={<AudioVisual />} />
                    <Route path="/timeline" element={<Timeline />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Layout>
              }
            />
          </Routes>
          <Toaster position="top-right" />
        </ThemeProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default App;
