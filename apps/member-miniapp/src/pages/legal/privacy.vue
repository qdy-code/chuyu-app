<template>
  <view class="page">
    <image class="page-bg" src="/static/brand/app-bg.jpg" mode="aspectFill" />
    <view class="header-card">
      <text class="header-title">隐私政策</text>
      <text class="header-desc">最后更新日期：2026-10-11</text>
    </view>

    <view class="card">
      <text class="section-title">一、我们是谁</text>
      <text class="para">
        "月光石屿MOONISLE"小程序（以下简称"本小程序"）由小程序登记主体运营，为顾客提供美甲、饰品、鲜花产品展示、到店预约和会员资料查询服务，不提供线上支付。
      </text>
    </view>

    <view class="card">
      <text class="section-title">二、我们收集哪些信息</text>
      <text class="para">为完成会员登录和服务展示，本小程序仅收集以下最小必要信息：</text>
      <text class="bullet">• 微信 OpenID：用于识别你的会员身份；通过 wx.login 获取。</text>
      <text class="bullet">• 手机号：由你主动点击微信手机号授权并确认后获取，或由你选择手动填写，用于门店会员身份核对、联系确认预约及维护会员资料。拒绝微信手机号授权后仍可手动填写。</text>
      <text class="bullet">• 昵称与头像：由你在完善资料或账户资料页主动填写或选择，保存到门店会员后台，用于小程序和后台会员资料展示；可选择稍后完善。</text>
      <text class="bullet">• 生日月日：由你自愿填写，用于会员关怀；不要求填写出生年份。</text>
      <text class="bullet">• 预约及服务信息：包括业务类型、所选产品、预约日期时间和备注，用于门店排期与履约。</text>
      <text class="bullet">• 会员业务记录：包括会员号、等级、余额、积分、充值记录和消费记录，用于向你展示门店会员权益。</text>
      <text class="para">除你主动选择头像文件外，本小程序不会持续读取你的相册；也不收集地理位置、通讯录、麦克风或摄像头信息。</text>
    </view>

    <view class="card">
      <text class="section-title">三、信息如何使用</text>
      <text class="bullet">• 用于会员身份识别、预约处理、会员卡展示、充值与消费记录查询。</text>
      <text class="bullet">• 为实现微信登录，我们会使用微信平台提供的登录能力；不会出售个人信息或用于与本服务无关的广告投放。</text>
    </view>

    <view class="card">
      <text class="section-title">四、信息如何保存</text>
      <text class="bullet">• 数据加密传输（HTTPS / TLS 1.2+）。</text>
      <text class="bullet">• 数据存储在境内服务器，仅经授权的门店运营人员和必要的技术维护人员可访问。</text>
      <text class="bullet">• 我们不会留存你的微信会话密钥（session_key），登录后即丢弃。</text>
      <text class="bullet">• 信息保存期限以提供会员服务所需的最短期限为限；法律法规另有要求的除外。</text>
    </view>

    <view class="card">
      <text class="section-title">五、你的权利</text>
      <text class="bullet">• 查看：在"账户资料"页可查看我们保存的全部会员信息。</text>
      <text class="bullet">• 更正：昵称和头像可在"账户资料"页修改；其他资料可联系运营者处理。</text>
      <text class="bullet">• 注销或删除：联系运营者提交申请。涉及未使用余额、未完成预约或依法需留存的交易记录时，将先完成核对。</text>
      <text class="bullet">• 撤回同意：你可以联系运营者撤回个人信息处理同意；撤回不影响此前处理活动的合法性，撤回后部分会员服务可能无法继续提供。</text>
      <text class="bullet">• 退出登录：在"账户资料"页点击"退出登录"会清除本机登录缓存，但不会自动删除服务器中的会员资料。</text>
    </view>

    <view class="card">
      <text class="section-title">六、未成年人保护</text>
      <text class="para">
        若你为未满 14 周岁的未成年人，请由监护人陪同阅读本政策并代为操作。我们不会在明知的情况下脱离监护人同意处理儿童个人信息。
      </text>
    </view>

    <view class="card">
      <text class="section-title">七、联系我们</text>
      <text class="para">
        如对本政策或个人信息处理有疑问，或需要行使查阅、更正、删除和注销权利，请通过以下方式联系运营者：{{ privacyContact }}。
      </text>
    </view>

    <view v-if="icpRecord" class="footer">
      <text class="footer-line">{{ icpRecord }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
const rawIcpRecord = (import.meta.env.VITE_ICP_RECORD as string | undefined)?.trim();
const icpRecord = rawIcpRecord && !/X{4,}|请填写|示例/i.test(rawIcpRecord) ? rawIcpRecord : undefined;
const privacyContact =
  (import.meta.env.VITE_PRIVACY_CONTACT as string | undefined)?.trim() || '小程序登记主体公开联系方式';
</script>

<style scoped>
.page {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  padding: 24rpx;
  background: #f6f3ea;
}

.page-bg {
  position: fixed;
  left: 0;
  top: 0;
  z-index: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
}

.page > view {
  position: relative;
  z-index: 1;
}

.header-card,
.card {
  border-radius: 30rpx;
  padding: 30rpx;
  background: #fff;
  box-shadow: 0 12rpx 38rpx rgba(31, 41, 55, 0.06);
}

.header-card {
  background: #edf2f4;
  color: #3d4652;
  margin-bottom: 22rpx;
}

.header-title {
  display: block;
  font-size: 36rpx;
  font-weight: 900;
}

.header-desc {
  display: block;
  margin-top: 10rpx;
  color: #6f7f8a;
  font-size: 24rpx;
}

.card {
  margin-top: 22rpx;
}

.section-title {
  display: block;
  font-size: 30rpx;
  font-weight: 800;
  color: #1f2937;
  margin-bottom: 16rpx;
}

.para,
.bullet {
  display: block;
  font-size: 26rpx;
  line-height: 1.75;
  color: #344054;
  margin-top: 10rpx;
}

.bullet {
  padding-left: 8rpx;
}

.emphasis {
  font-weight: 800;
  color: #b42318;
}

.footer {
  margin-top: 40rpx;
  padding: 24rpx 0 32rpx;
  text-align: center;
}

.footer-line {
  font-size: 22rpx;
  color: #98a2b3;
}
</style>
