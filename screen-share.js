class ScreenShare {
    constructor() {
        this.stream = null;
        this.mediaRecorder = null;
        this.recordedChunks = [];

        // DOM 元素
        this.video = document.getElementById('screenVideo');
        this.startButton = document.getElementById('startShare');
        this.stopButton = document.getElementById('stopShare');
        this.startRecordButton = document.getElementById('startRecord');
        this.stopRecordButton = document.getElementById('stopRecord');
        this.statusDiv = document.getElementById('status');
        this.infoDiv = document.getElementById('info');
        this.frameRateSelect = document.getElementById('frameRate');
        this.resolutionSelect = document.getElementById('resolution');

        // 添加用户相关变量
        this.currentUser = null;
        this.users = JSON.parse(localStorage.getItem('users') || '{}');

        // 添加用户相关DOM元素
        this.userContainer = document.getElementById('userContainer');
        this.loginForm = document.getElementById('loginForm');
        this.userInfo = document.getElementById('userInfo');
        this.usernameInput = document.getElementById('username');
        this.passwordInput = document.getElementById('password');
        this.loginBtn = document.getElementById('loginBtn');
        this.registerBtn = document.getElementById('registerBtn');
        this.logoutBtn = document.getElementById('logoutBtn');
        this.currentUserSpan = document.getElementById('currentUser');

        // 禁用共享功能，直到用户登录
        this.startButton.disabled = true;
        
        // 添加全屏相关元素
        this.fullscreenBtn = document.getElementById('fullscreenBtn');
        this.screenContainer = document.querySelector('.screen-container');
        
        this.bindEvents();
        this.bindUserEvents();
        this.checkLogin();

        // 绑定全屏相关事件
        this.bindFullscreenEvents();
    }

    bindEvents() {
        this.startButton.addEventListener('click', () => this.startSharing());
        this.stopButton.addEventListener('click', () => this.stopSharing());
        this.startRecordButton.addEventListener('click', () => this.startRecording());
        this.stopRecordButton.addEventListener('click', () => this.stopRecording());

        // 监听质量设置变化
        this.frameRateSelect.addEventListener('change', () => this.updateQuality());
        this.resolutionSelect.addEventListener('change', () => this.updateQuality());
    }

    // 添加用户相关事件绑定
    bindUserEvents() {
        this.loginBtn.addEventListener('click', () => this.login());
        this.registerBtn.addEventListener('click', () => this.register());
        this.logoutBtn.addEventListener('click', () => this.logout());
    }

    // 检查登录状态
    checkLogin() {
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            this.showUserInfo();
            this.startButton.disabled = false;
        }
    }

    // 登录
    login() {
        const username = this.usernameInput.value.trim();
        const password = this.passwordInput.value;

        if (!username || !password) {
            this.showError('请输入用户名和密码');
            return;
        }

        const user = this.users[username];
        if (!user || user.password !== password) {
            this.showError('用户名或密码错误');
            return;
        }

        this.currentUser = {
            username,
            lastLogin: new Date().toISOString()
        };

        localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
        this.showUserInfo();
        this.startButton.disabled = false;
    }

    // 注册
    register() {
        const username = this.usernameInput.value.trim();
        const password = this.passwordInput.value;

        if (!username || !password) {
            this.showError('请输入用户名和密码');
            return;
        }

        if (this.users[username]) {
            this.showError('用户名已存在');
            return;
        }

        this.users[username] = {
            username,
            password,
            createdAt: new Date().toISOString()
        };

        localStorage.setItem('users', JSON.stringify(this.users));
        alert('注册成功，请登录');
        this.usernameInput.value = '';
        this.passwordInput.value = '';
    }

    // 退出
    logout() {
        if (this.stream) {
            this.stopSharing();
        }
        
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        this.showLoginForm();
        this.startButton.disabled = true;
    }

    // 显示用户信息
    showUserInfo() {
        this.loginForm.style.display = 'none';
        this.userInfo.style.display = 'flex';
        this.currentUserSpan.textContent = `当前用户: ${this.currentUser.username}`;
    }

    // 显示登录表单
    showLoginForm() {
        this.loginForm.style.display = 'flex';
        this.userInfo.style.display = 'none';
        this.usernameInput.value = '';
        this.passwordInput.value = '';
    }

    async startSharing() {
        if (!this.currentUser) {
            this.showError('请先登录');
            return;
        }

        try {
            const frameRate = parseInt(this.frameRateSelect.value);
            const height = parseInt(this.resolutionSelect.value);

            const options = {
                video: {
                    cursor: "always",
                    frameRate: frameRate,
                    height: height,
                    width: { ideal: height * 16 / 9 }
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            };

            this.stream = await navigator.mediaDevices.getDisplayMedia(options);
            
            this.video.srcObject = this.stream;
            this.startButton.disabled = true;
            this.stopButton.disabled = false;
            this.startRecordButton.disabled = false;
            this.statusDiv.textContent = '正在共享';

            // 监听流结束
            this.stream.getVideoTracks()[0].addEventListener('ended', () => {
                this.stopSharing();
            });

            // 显示流信息
            this.updateStreamInfo();

            // 显示全屏按钮
            this.fullscreenBtn.style.display = 'flex';

        } catch (error) {
            console.error('共享屏幕失败:', error);
            this.showError('共享屏幕失败: ' + error.message);
        }
    }

    stopSharing() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.video.srcObject = null;
            this.stream = null;
        }

        this.startButton.disabled = false;
        this.stopButton.disabled = true;
        this.startRecordButton.disabled = true;
        this.stopRecordButton.disabled = true;
        this.statusDiv.textContent = '未开始共享';
        this.infoDiv.textContent = '';

        // 如果在全屏状态，退出全屏
        if (this.isFullscreen()) {
            this.exitFullscreen();
        }
        
        // 隐藏全屏按钮
        this.fullscreenBtn.style.display = 'none';
    }

    startRecording() {
        if (!this.currentUser) {
            this.showError('请先登录');
            return;
        }

        if (!this.stream) return;

        this.recordedChunks = [];
        const options = { mimeType: 'video/webm;codecs=vp9' };
        
        try {
            this.mediaRecorder = new MediaRecorder(this.stream, options);
        } catch (error) {
            console.error('创建MediaRecorder失败:', error);
            this.showError('不支持录制功能');
            return;
        }

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.recordedChunks.push(event.data);
            }
        };

        this.mediaRecorder.onstop = () => {
            const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.currentUser.username}-screen-recording-${new Date().toISOString()}.webm`;
            a.click();
            URL.revokeObjectURL(url);
        };

        this.mediaRecorder.start();
        this.startRecordButton.disabled = true;
        this.stopRecordButton.disabled = false;
        this.statusDiv.textContent = '正在录制...';
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
            this.startRecordButton.disabled = false;
            this.stopRecordButton.disabled = true;
            this.statusDiv.textContent = '正在共享';
        }
    }

    updateQuality() {
        if (this.stream) {
            this.stopSharing();
            this.startSharing();
        }
    }

    updateStreamInfo() {
        if (!this.stream) return;

        const videoTrack = this.stream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();

        this.infoDiv.innerHTML = `
            <strong>流信息:</strong><br>
            用户: ${this.currentUser.username}<br>
            分辨率: ${settings.width}x${settings.height}<br>
            帧率: ${settings.frameRate} FPS<br>
            设备: ${videoTrack.label}
        `;
    }

    showError(message) {
        this.statusDiv.textContent = '错误';
        this.infoDiv.innerHTML = `<span style="color: #ff4444;">${message}</span>`;
    }

    // 添加全屏相关事件绑定
    bindFullscreenEvents() {
        this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        
        // 监听全屏变化
        document.addEventListener('fullscreenchange', () => {
            this.updateFullscreenUI();
        });

        // 监听 ESC 键
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isFullscreen()) {
                this.exitFullscreen();
            }
        });
    }

    // 切换全屏状态
    async toggleFullscreen() {
        if (!this.isFullscreen()) {
            await this.enterFullscreen();
        } else {
            await this.exitFullscreen();
        }
    }

    // 进入全屏
    async enterFullscreen() {
        try {
            if (this.screenContainer.requestFullscreen) {
                await this.screenContainer.requestFullscreen();
            } else if (this.screenContainer.webkitRequestFullscreen) {
                await this.screenContainer.webkitRequestFullscreen();
            } else if (this.screenContainer.msRequestFullscreen) {
                await this.screenContainer.msRequestFullscreen();
            }
            
            this.screenContainer.classList.add('fullscreen');
            this.addFullscreenControls();
        } catch (error) {
            console.error('进入全屏失败:', error);
            this.showError('无法进入全屏模式');
        }
    }

    // 退出全屏
    async exitFullscreen() {
        try {
            if (document.exitFullscreen) {
                await document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                await document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                await document.msExitFullscreen();
            }
            
            this.screenContainer.classList.remove('fullscreen');
            this.removeFullscreenControls();
        } catch (error) {
            console.error('退出全屏失败:', error);
        }
    }

    // 检查是否全屏
    isFullscreen() {
        return !!(
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.msFullscreenElement
        );
    }

    // 更新全屏UI
    updateFullscreenUI() {
        const isFullscreen = this.isFullscreen();
        this.screenContainer.classList.toggle('fullscreen', isFullscreen);
        
        if (isFullscreen) {
            this.addFullscreenControls();
        } else {
            this.removeFullscreenControls();
        }
    }

    // 添加全屏控制栏
    addFullscreenControls() {
        if (!this.fullscreenControls) {
            this.fullscreenControls = document.createElement('div');
            this.fullscreenControls.className = 'fullscreen-controls';
            
            // 添加用户信息和控制按钮
            this.fullscreenControls.innerHTML = `
                <div class="user-info">
                    ${this.currentUser ? `观看用户: ${this.currentUser.username}` : ''}
                </div>
                <div class="control-buttons">
                    <button onclick="screenShare.exitFullscreen()">退出全屏</button>
                </div>
            `;
            
            this.screenContainer.appendChild(this.fullscreenControls);
        }
    }

    // 移除全屏控制栏
    removeFullscreenControls() {
        if (this.fullscreenControls) {
            this.fullscreenControls.remove();
            this.fullscreenControls = null;
        }
    }
}

// 初始化
const screenShare = new ScreenShare(); 