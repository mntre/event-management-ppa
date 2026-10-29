let html5QrCode;
let config = {
  apiUrl: '',
  sheetId: '',
  attendanceTab: 'Attendance'
};

let stats = {
  total: 0,
  success: 0,
  duplicates: 0
};

const scannedInSession = new Set();
let isProcessing = false;

function startScanner() {
  config.apiUrl = document.getElementById('apiUrl').value.trim();
  config.sheetId = document.getElementById('sheetId').value.trim();
  config.attendanceTab = document.getElementById('attendanceTab').value.trim();
  
  if (!config.apiUrl) {
    alert('Please enter the Apps Script API URL');
    return;
  }
  
  if (!config.sheetId) {
    alert('Please enter a Google Sheet ID');
    return;
  }
  
  // Save to localStorage
  localStorage.setItem('apiUrl', config.apiUrl);
  localStorage.setItem('sheetId', config.sheetId);
  localStorage.setItem('attendanceTab', config.attendanceTab);
  
  // Hide config, show scanner
  document.getElementById('config-section').style.display = 'none';
  document.getElementById('scanner-section').style.display = 'block';
  
  // Initialize QR scanner
  initializeScanner();
}

async function initializeScanner() {
  try {
    html5QrCode = new Html5Qrcode("reader");
    
    const qrConfig = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0
    };
    
    await html5QrCode.start(
      { facingMode: "environment" },
      qrConfig,
      onScanSuccess,
      onScanFailure
    );
    
  } catch (err) {
    console.error('Error starting scanner:', err);
    showStatus('error', 'Camera Error', `Failed to start camera: ${err.message}`);
  }
}

async function onScanSuccess(decodedText, decodedResult) {
  if (isProcessing) return;
  if (scannedInSession.has(decodedText)) return;
  
  isProcessing = true;
  scannedInSession.add(decodedText);
  
  try {
    await html5QrCode.pause(true);
  } catch (e) {
    console.log('Pause error:', e);
  }
  
  const employeeId = decodedText.trim();
  
  stats.total++;
  updateStats();
  
  showStatus('processing', 'Processing...', `Checking Employee ID: ${employeeId}`);
  
  try {
    const result = await markAttendance(employeeId);
    
    if (result.success) {
      if (result.data && result.data.duplicate) {
        stats.duplicates++;
        showStatus('warning', 'Already Checked In!', 
          `Employee ID: ${employeeId} was already marked present at ${result.data.timestamp}`,
          result.data);
      } else {
        stats.success++;
        showStatus('success', 'Attendance Marked! ✓', 
          `Successfully marked Employee ID: ${employeeId} as present`, result.data);
      }
    } else {
      showStatus('error', 'Error', result.message);
    }
    
    updateStats();
    
    setTimeout(async () => {
      try {
        await html5QrCode.resume();
        isProcessing = false;
        setTimeout(() => scannedInSession.delete(employeeId), 5000);
      } catch (e) {
        console.log('Resume error:', e);
        isProcessing = false;
      }
    }, 3000);
    
  } catch (error) {
    console.error('Error marking attendance:', error);
    showStatus('error', 'Error', error.message);
    
    setTimeout(async () => {
      try {
        await html5QrCode.resume();
        isProcessing = false;
        scannedInSession.delete(employeeId);
      } catch (e) {
        console.log('Resume error:', e);
        isProcessing = false;
      }
    }, 3000);
  }
}

function onScanFailure(error) {
  // Ignore
}

async function markAttendance(employeeId) {
  try {
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        employeeId: employeeId,
        sheetId: config.sheetId,
        attendanceTab: config.attendanceTab
      }),
      redirect: 'follow'
    });
    
    const text = await response.text();
    console.log('Response:', text);
    
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error('Invalid response from server');
    }
    
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

function showStatus(type, title, message, employeeInfo = null) {
  const statusDiv = document.getElementById('status');
  
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    processing: '⏳'
  };
  
  let employeeHtml = '';
  if (employeeInfo && !employeeInfo.duplicate) {
    employeeHtml = `
      <div class="employee-info">
        <p><strong>Employee ID:</strong> ${employeeInfo.employeeId}</p>
        <p><strong>Name:</strong> ${employeeInfo.firstName} ${employeeInfo.lastName}</p>
        <p><strong>Email:</strong> ${employeeInfo.email}</p>
        <p><strong>Department:</strong> ${employeeInfo.department}</p>
        <p><strong>Timestamp:</strong> ${employeeInfo.timestamp}</p>
      </div>
    `;
  } else if (employeeInfo && employeeInfo.duplicate) {
    employeeHtml = `
      <div class="employee-info">
        <p><strong>Employee ID:</strong> ${employeeInfo.employeeId}</p>
        <p><strong>Name:</strong> ${employeeInfo.firstName} ${employeeInfo.lastName}</p>
        <p><strong>Original Check-in:</strong> ${employeeInfo.timestamp}</p>
      </div>
    `;
  }
  
  statusDiv.innerHTML = `
    <div class="status-icon">${icons[type]}</div>
    <h2>${title}</h2>
    <p>${message}</p>
    ${employeeHtml}
  `;
  
  statusDiv.className = `status show ${type}`;
  
  playSound(type);
}

function updateStats() {
  document.getElementById('totalScans').textContent = stats.total;
  document.getElementById('successScans').textContent = stats.success;
  document.getElementById('duplicateScans').textContent = stats.duplicates;
}

function playSound(type) {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    const frequencies = {
      success: 800,
      error: 300,
      warning: 500,
      processing: 600
    };
    
    oscillator.frequency.value = frequencies[type] || 600;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch (e) {
    console.log('Audio not supported:', e);
  }
}

// Load saved config on page load
window.addEventListener('DOMContentLoaded', () => {
  const savedApiUrl = localStorage.getItem('apiUrl');
  const savedSheetId = localStorage.getItem('sheetId');
  const savedTab = localStorage.getItem('attendanceTab');
  
  if (savedApiUrl) document.getElementById('apiUrl').value = savedApiUrl;
  if (savedSheetId) document.getElementById('sheetId').value = savedSheetId;
  if (savedTab) document.getElementById('attendanceTab').value = savedTab;
});
