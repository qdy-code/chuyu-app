<template>
  <view class="page">
    <view class="header-card">
      <text class="header-title">用户服务协议</text>
      <text class="header-desc">最后更新日期：2026-05-28</text>
    </view>

    <view class="card">
      <text class="section-title">一、协议主体</text>
      <text class="para">
        本协议是你与"初屿会员"小程序（以下简称"本小程序"）运营者之间就使用本小程序服务所达成的协议。
      </text>
      <text class="para">
        在你使用本小程序前，请仔细阅读本协议。继续使用即视为你已阅读、理解并同意本协议全部条款。
      </text>
    </view>

    <view class="card">
      <text class="section-title">二、服务内容</text>
      <text class="para">本小程序面向门店会员提供以下基础服务：</text>
      <text class="bullet">• 会员卡查看</text>
      <text class="bullet">• 到店预约提交</text>
      <text class="bullet">• 历史消费记录查询</text>
      <text class="bullet">• 会员等级与折扣展示</text>
      <text class="para">本小程序不进行任何线上交易、不收取费用、不展示广告。</text>
    </view>

    <view class="card">
      <text class="section-title">三、账号与登录</text>
      <text class="bullet">• 你通过微信账号一键登录，无需另设密码。</text>
      <text class="bullet">• 一个微信账号对应一个会员档案，不可转让。</text>
      <text class="bullet">• 你应妥善保管微信账号，因账号泄露造成的损失由你自行承担。</text>
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
        我们尊重并保护你的个人信息。具体条款请阅读《隐私政策》。继续使用本小程序即视为你同意《隐私政策》内容。
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
        运营者有权根据法律法规或业务需要修订本协议，修订后会在小程序内提示。继续使用即视为接受修订后的协议。
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
