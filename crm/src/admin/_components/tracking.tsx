import React from 'react';

const TrackingButtons: React.FC = () => {
  const trackingServices = [
    {
      name: "UPS TRACK",
      url: "https://www.ups.com/track?loc=en_IN&requester=ST/",
      color: "bg-amber-500 hover:bg-amber-600",
      textColor: "text-white",
      icon: (
        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L2 7l10 5 10-5-10-5zm0 2.5L20 7l-8 4-8-4 8-4.5z"/>
          <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
      )
    },
    {
      name: "FEDEX",
      url: "https://www.fedex.com/en-us/tracking.html",
      color: "bg-purple-700 hover:bg-purple-800",
      textColor: "text-white",
      icon: (
        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L2 7l10 5 10-5-10-5zm0 2.5L20 7l-8 4-8-4 8-4.5z"/>
          <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
      )
    },
    {
      name: "DHL",
      url: "https://www.dhl.com/in-en/home/tracking.html",
      color: "bg-yellow-500 hover:bg-yellow-600",
      textColor: "text-black",
      icon: (
        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L2 7l10 5 10-5-10-5zm0 2.5L20 7l-8 4-8-4 8-4.5z"/>
          <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
      )
    }
  ];

  const handleButtonClick = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-6 md:p-8 max-w-lg w-full">
        <h1 className="text-3xl font-bold text-gray-800 mb-2 text-center">Package Tracking</h1>
        <p className="text-gray-600 mb-8 text-center">Track your packages using the services below</p>
        
        <div className="space-y-4">
          {trackingServices.map((service, index) => (
            <button
              key={index}
              onClick={() => handleButtonClick(service.url)}
              className={`w-full flex items-center justify-center py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 ${service.color} ${service.textColor} font-semibold shadow-md`}
            >
              {service.icon}
              {service.name}
            </button>
          ))}
        </div>
        
        <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h2 className="text-lg font-semibold text-blue-800 mb-2">How to use</h2>
          <p className="text-blue-700">Click on any of the tracking buttons above to open the respective tracking service in a new tab.</p>
        </div>
      </div>
    </div>
  );
};

export default TrackingButtons;