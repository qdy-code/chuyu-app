<template>
  <view class="page">
    <view class="header-card">
      <text class="header-title">隐私政策</text>
      <text class="header-desc">最后更新日期：2026-05-28</text>
    </view>

    <view class="card">
      <text class="section-title">一、我们是谁</text>
      <text class="para">
        "初屿会员"小程序（以下简称"本小程序"）由个人开发者运营，仅向到店消费的会员提供卡片、预约、消费记录查看等服务。
      </text>
    </view>

    <view class="card">
      <text class="section-title">二、我们收集哪些信息</text>
      <text class="para">为完成会员登录和服务展示，本小程序仅收集以下最小必要信息：</text>
      <text class="bullet">• 微信 OpenID：用于识别你的会员身份；通过 wx.login 获取，不包含手机号、昵称、头像等个人信息。</text>
      <text class="bullet">• 你在小程序内主动填写的生日、备注：用于会员等级和到店服务匹配。</text>
      <text class="bullet">• 预约时间、预约备注：用于门店安排到店服务。</text>
      <text class="para">
        本小程序<text class="emphasis">不收集</text>你的手机号、地理位置、相册、通讯录、麦克风、摄像头等敏感信息。
      </text>
      <text class="para">
        如果你曾在门店登记过手机号，门店管理员会以纸质或店内系统方式留存，但不会出现在本小程序的注册流程中。
      </text>
    </view>

    <view class="card">
      <text class="section-title">三、信息如何使用</text>
      <text class="bullet">• 仅用于本小程序的会员身份识别、会员卡展示、预约与消费记录查询。</text>
      <text class="bullet">• 不会用于广告投放、不会出售给任何第三方。</text>
    </view>

    <view class="card">
      <text class="section-title">四、信息如何保存</text>
      <text class="bullet">• 数据加密传输（HTTPS / TLS 1.2+）。</text>
      <text class="bullet">• 数据存储在境内云服务器，仅与会员业务相关的人员（开发者本人 / 门店管理员）有访问权限。</text>
      <text class="bullet">• 我们不会留存你的微信会话密钥（session_key），登录后即丢弃。</text>
    </view>

    <view class="card">
      <text class="section-title">五、你的权利</text>
      <text class="bullet">• 查看：在"账户资料"页可查看我们保存的全部会员信息。</text>
      <text class="bullet">• 注销：联系门店管理员或本小程序运营者，提供 OpenID 后可删除你的会员数据。</text>
      <text class="bullet">• 撤回：你可以随时在"账户资料"页点击"退出登录"清除本机缓存。</text>
    </view>

    <view class="card">
      <text class="section-title">六、未成年人保护</text>
      <text class="para">
        若你为未满 14 周岁的未成年人，请由监护人陪同阅读本政策并代为操作。我们不会主动收集未成年人的任何信息。
      </text>
    </view>

    <view class="card">
      <text class="section-title">七、联系我们</text>
      <text class="para">
        如对本隐私政策有任何疑问，可在门店现场反馈，或通过小程序设置中的客服功能联系运营者。
      </text>
    </view>

    <view class="footer">
      <text class="footer-line">{{ icpRecord }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
const icpRecord = (import.meta.env.VITE_ICP_RECORD as string | undefined) || '陕ICP备XXXXXXXX号';
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 24rpx;
  background: #f7f4ef;
}

.header-card,
.card {
  border-radius: 30rpx;
  padding: 30rpx;
  background: #fff;
  box-shadow: 0 12rpx 38rpx rgba(31, 41, 55, 0.06);
}

.header-card {
  background: linear-gradient(135deg, #cf2c2c, #9b1717);
  color: #fff;
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
  color: rgba(255, 255, 255, 0.82);
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
