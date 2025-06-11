import React, { useState } from 'react';
import AuthWrapper from './components/AuthWrapper';
import Navigation from './components/Navigation';
import Dashboard from './components/Dashboard';
import TeamView from './components/TeamView';
import HistoryView from './components/HistoryView';
import PhotosView from './components/PhotosView';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'team':
        return <TeamView />;
      case 'history':
        return <HistoryView />;
      case 'photos':
        return <PhotosView />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <AuthWrapper>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {renderActiveView()}
        </main>
      </div>
    </AuthWrapper>
  );
}

export default App;