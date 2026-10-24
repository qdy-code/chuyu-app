<template>
  <view class="page">
    <image class="page-bg" src="/static/brand/app-bg.jpg" mode="aspectFill" />
    <view class="header-card">
      <text class="header-title">用户服务协议</text>
      <text class="header-desc">最后更新日期：2026-07-12</text>
    </view>

    <view class="card">
      <text class="section-title">一、协议主体</text>
      <text class="para">
        本协议是你与"月光石屿MOONISLE"小程序（以下简称"本小程序"）运营者之间就使用本小程序服务所达成的协议。
      </text>
      <text class="para">
        在你使用会员功能前，请仔细阅读本协议。你在登录页主动勾选并点击"登录"，表示你已阅读、理解并同意本协议。
      </text>
    </view>

    <view class="card">
      <text class="section-title">二、服务内容</text>
      <text class="para">本小程序面向门店会员提供以下基础服务：</text>
      <text class="bullet">• 会员卡查看</text>
      <text class="bullet">• 美甲、饰品和鲜花产品分类展示及参考价查看</text>
      <text class="bullet">• 美甲到店、饰品预留和鲜花取花预约</text>
      <text class="bullet">• 历史消费记录查询</text>
      <text class="bullet">• 会员等级与折扣展示</text>
      <text class="para">产品参考价仅供展示，实际服务内容和金额以门店确认为准。本小程序不提供购物车、线上下单或线上支付。</text>
    </view>

    <view class="card">
      <text class="section-title">三、账号与登录</text>
      <text class="bullet">• 可使用微信登录；已由门店开通账号的会员，也可选择账号密码登录。</text>
      <text class="bullet">• 一个微信账号对应一个会员档案，不可转让。</text>
      <text class="bullet">• 浏览作品无需登录。微信会员完善手机号用于门店确认预约和会员资料；账号密码登录不要求微信手机号授权，关联门店会员仍需本人微信验证及门店核验。</text>
      <text class="bullet">• 你应妥善保管微信账号及登录密码，因账号泄露造成的损失由你自行承担。</text>
    </view>

    <view class="card">
      <text class="section-title">四、用户行为规范</text>
      <text class="para">使用本小程序时，你不得：</text>
      <text class="bullet">• 通过技术手段干扰小程序正常运行</text>
      <text class="bullet">• 提交虚假预约信息扰乱门店秩序</text>
      <text class="bullet">• 利用本小程序从事任何违法或侵害他人权益的行为</text>
      <text class="para">如发现上述行为，运营者有权关闭你的会员档案并保留追究法律责任的权利。</text>
    </view>

    <view class="card">
      <text class="section-title">五、隐私保护</text>
      <text class="para">
        我们尊重并保护你的个人信息。具体条款请阅读《隐私政策》，并由你在登录页主动勾选确认。
      </text>
    </view>

    <view class="card">
      <text class="section-title">六、服务变更与终止</text>
      <text class="bullet">• 本小程序运营者可根据业务调整对功能进行升级、变更或下线，将在小程序内提示。</text>
      <text class="bullet">• 你可以随时停止使用本小程序，或通过"退出登录"清除本机缓存。</text>
    </view>

    <view class="card">
      <text class="section-title">七、免责声明</text>
      <text class="bullet">• 因不可抗力（如微信平台变更、网络故障等）导致服务中断，运营者不承担责任。</text>
      <text class="bullet">• 预约时间以门店实际确认为准，最终到店服务由线下门店履行。</text>
    </view>

    <view class="card">
      <text class="section-title">八、协议变更</text>
      <text class="para">
        运营者有权根据法律法规或业务需要修订本协议，修订后会在小程序内提示；如需继续使用会员功能，将再次请你主动确认。
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
