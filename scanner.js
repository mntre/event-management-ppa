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
let scanMode = 'camera'; // 'camera' or 'upload'

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
  
  // Show attendance log
  document.getElementById('attendanceLog').style.display = 'block';
  
  // Initialize QR scanner
  initializeScanner();
}

function switchToCamera() {
  scanMode = 'camera';
  document.getElementById('camera-mode').style.display = 'block';
  document.getElementById('upload-mode').style.display = 'none';
  document.getElementById('cameraBtn').style.background = '#28a745';
  document.getElementById('uploadBtn').style.background = '#6c757d';
  
  if (!html5QrCode || !html5QrCode.isScanning) {
    initializeScanner();
  }
}

function switchToUpload() {
  scanMode = 'upload';
  document.getElementById('camera-mode').style.display = 'none';
  document.getElementById('upload-mode').style.display = 'block';
  document.getElementById('cameraBtn').style.background = '#6c757d';
  document.getElementById('uploadBtn').style.background = '#28a745';
  
  // Stop camera if running
  if (html5QrCode && html5QrCode.isScanning) {
    html5QrCode.stop().catch(err => console.log('Stop error:', err));
  }
}

async function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  // Show preview
  const previewDiv = document.getElementById('upload-preview');
  const previewImg = document.getElementById('preview-image');
  previewDiv.style.display = 'block';
  previewImg.src = URL.createObjectURL(file);
  
  showStatus('processing', 'Processing...', 'Scanning QR code from image...');
  
  try {
    if (!html5QrCode) {
      html5QrCode = new Html5Qrcode("reader");
    }
    
    const result = await html5QrCode.scanFile(file, true);
    
    // Process the scanned result
    await processScannedCode(result);
    
    // Clear the file input for next scan
    event.target.value = '';
    
  } catch (err) {
    console.error('Error scanning image:', err);
    showStatus('error', 'Scan Failed', 'Could not find a valid QR code in this image. Please try another image.');
    
    // Clear preview after 3 seconds
    setTimeout(() => {
      previewDiv.style.display = 'none';
      event.target.value = '';
    }, 3000);
  }
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
  
  await processScannedCode(decodedText);
  
  setTimeout(async () => {
    try {
      await html5QrCode.resume();
      isProcessing = false;
      setTimeout(() => scannedInSession.delete(decodedText), 5000);
    } catch (e) {
      console.log('Resume error:', e);
      isProcessing = false;
    }
  }, 3000);
}

async function processScannedCode(decodedText) {
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
        
        // Show success modal
        showSuccessModal(result.data);
        
        // Add to attendance log
        addToAttendanceLog(result.data);
        
        showStatus('success', 'Attendance Marked! ✓', 
          `Successfully marked Employee ID: ${employeeId} as present`, result.data);
      }
    } else {
      showStatus('error', 'Error', result.message);
    }
    
    updateStats();
    
  } catch (error) {
    console.error('Error marking attendance:', error);
    showStatus('error', 'Error', error.message);
    
    if (scanMode === 'camera') {
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
}

function showSuccessModal(employeeInfo) {
  const modal = document.getElementById('successModal');
  const nameEl = document.getElementById('modalEmployeeName');
  const detailsEl = document.getElementById('modalDetails');
  
  nameEl.textContent = `${employeeInfo.firstName} ${employeeInfo.lastName}`;
  
  detailsEl.innerHTML = `
    <div class="modal-detail-row">
      <span class="modal-detail-label">Employee ID:</span>
      <span class="modal-detail-value">${employeeInfo.employeeId}</span>
    </div>
    <div class="modal-detail-row">
      <span class="modal-detail-label">Department:</span>
      <span class="modal-detail-value">${employeeInfo.department}</span>
    </div>
    <div class="modal-detail-row">
      <span class="modal-detail-label">Time:</span>
      <span class="modal-detail-value">${employeeInfo.timestamp}</span>
    </div>
  `;
  
  modal.classList.add('show');
  
  // Auto-close after 3 seconds
  setTimeout(() => {
    closeSuccessModal();
  }, 3000);
}

function closeSuccessModal() {
  const modal = document.getElementById('successModal');
  modal.classList.remove('show');
}

function addToAttendanceLog(employeeInfo) {
  const logContent = document.getElementById('logContent');
  
  const logItem = document.createElement('div');
  logItem.className = 'log-item';
  logItem.innerHTML = `
    <div class="log-name">${employeeInfo.firstName} ${employeeInfo.lastName}</div>
    <div class="log-id">ID: ${employeeInfo.employeeId}</div>
    <div class="log-time">${new Date().toLocaleTimeString()}</div>
  `;
  
  // Add to top of log
  logContent.insertBefore(logItem, logContent.firstChild);
  
  // Keep only last 10 entries
  while (logContent.children.length > 10) {
    logContent.removeChild(logContent.lastChild);
  }
}

function onScanFailure(error) {
  // Ignore
}

async function markAttendance(employeeId) {
  return new Promise((resolve, reject) => {
    // Create unique callback name
    const callbackName = 'jsonpCallback_' + Date.now();
    
    // Build URL with parameters
    const params = new URLSearchParams({
      action: 'markAttendance',
      employeeId: employeeId,
      sheetId: config.sheetId,
      attendanceTab: config.attendanceTab,
      callback: callbackName
    });
    
    const url = config.apiUrl + '?' + params.toString();
    
    // Create script element for JSONP
    const script = document.createElement('script');
    
    // Define callback function
    window[callbackName] = function(data) {
      // Clean up
      delete window[callbackName];
      document.body.removeChild(script);
      
      // Check response format
      if (data.success !== undefined) {
        resolve(data);
      } else if (data.message) {
        resolve(data);
      } else {
        reject(new Error('Invalid response format'));
      }
    };
    
    // Handle errors
    script.onerror = function() {
      delete window[callbackName];
      document.body.removeChild(script);
      reject(new Error('Failed to load API'));
    };
    
    // Set timeout
    setTimeout(() => {
      if (window[callbackName]) {
        delete window[callbackName];
        if (script.parentNode) {
          document.body.removeChild(script);
        }
        reject(new Error('Request timeout'));
      }
    }, 15000);
    
    // Load script
    script.src = url;
    document.body.appendChild(script);
  });
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
