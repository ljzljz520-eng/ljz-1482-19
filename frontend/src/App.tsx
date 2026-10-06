import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import AudioVisual from "./pages/AudioVisual";
import Timeline from "./pages/Timeline";
import ParkOverview from "./pages/ParkOverview";
import ErrorBoundary from "./components/ErrorBoundary";
import ThemeProvider from "./theme/ThemeProvider";
import BrandLayout from "./pages/brand/BrandLayout";
import ConsolePage from "./pages/brand/ConsolePage";
import VersionsPage from "./pages/brand/VersionsPage";
import ProjectsPage from "./pages/brand/ProjectsPage";
import AssetsPage from "./pages/brand/AssetsPage";
import VerifyPage from "./pages/brand/VerifyPage";
import { Toaster } from "react-hot-toast";

const App = () => {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <ThemeProvider>
          <Layout>
            <Routes>
              <Route path="/" element={<ParkOverview />} />
              <Route path="/audiovisual" element={<AudioVisual />} />
              <Route path="/timeline" element={<Timeline />} />
              <Route path="/brand" element={<BrandLayout />}>
                <Route index element={<ConsolePage />} />
                <Route path="versions" element={<VersionsPage />} />
                <Route path="projects" element={<ProjectsPage />} />
                <Route path="assets" element={<AssetsPage />} />
                <Route path="verify" element={<VerifyPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Toaster position="top-right" />
          </Layout>
        </ThemeProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default App;
