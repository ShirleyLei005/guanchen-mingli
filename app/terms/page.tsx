import type { Metadata } from "next";
import { PolicyShell } from "../policy-shell";

export const metadata: Metadata = {
  title: "用户协议 · 观辰",
  description: "观辰服务的使用规则、积分规则、免责声明与用户责任。",
};

export default function TermsPage() {
  return (
    <PolicyShell
      eyebrow="TERMS · 使用规则"
      title="用户协议"
      intro="使用观辰即表示你理解并同意以下条款。观辰提供的是传统文化娱乐与自我反思工具，任何内容都不替代现实中的专业意见与个人判断。"
    >
      <article className="policy-section">
        <h2>一、服务性质</h2>
        <p>观辰提供八字、紫微斗数、双人合盘、固定命盘问答等排盘与解读服务。所有盘面均按固定算法生成，解读内容用于文化娱乐、自我观察与决策参考。</p>
        <p>观辰不构成医疗、心理、法律、投资或其他专业服务，也不对任何具体事件、日期或结果作出保证。</p>
      </article>

      <article className="policy-section">
        <h2>二、账号与注册</h2>
        <ul>
          <li>注册时应使用本人有权使用的真实邮箱，并完成邮箱验证。</li>
          <li>不得使用虚假邮箱、随机邮箱批量注册，不得冒用他人身份，不得通过脚本、代理或其他自动化手段绕过防滥用措施。</li>
          <li>账号仅限本人使用，不得转让、出借或出售。</li>
          <li>观辰有权对违反注册规则、存在安全风险或滥用行为的账号采取限制、冻结或封禁措施。</li>
        </ul>
      </article>

      <article className="policy-section">
        <h2>三、积分规则</h2>
        <ul>
          <li>未登录或未注册用户积分为 0。</li>
          <li>新用户完成邮箱验证后可获赠 5 积分，同一账号不重复赠送。</li>
          <li>积分用于解锁八字、紫微斗数、双人合盘、观辰解析等付费内容，不兑换现金，不可提现或转赠。</li>
          <li>生成失败、服务异常或平台原因导致扣分错误时，观辰会按幂等规则返还或补偿积分。</li>
          <li>积分有效期、套餐规则若有调整，观辰会提前在网站公示。</li>
        </ul>
      </article>

      <article className="policy-section">
        <h2>四、用户行为规范</h2>
        <ul>
          <li>仅提交本人有权使用的出生资料；涉及他人资料时，应确保已获得授权。</li>
          <li>不得上传违法、侵权、骚扰、歧视或恶意内容。</li>
          <li>不得攻击、干扰、逆向工程、抓取或滥用网站接口与数据。</li>
          <li>不得利用积分规则、退款规则或支付流程进行套利或欺诈。</li>
        </ul>
      </article>

      <article className="policy-section">
        <h2>五、内容与知识产权</h2>
        <p>你提交的出生资料、问题与授权内容，仅用于为你提供服务。观辰的产品代码、排盘算法、界面设计、报告结构与文案等，归观辰或其权利人所有。</p>
        <p>生成的报告仅供个人使用，未经书面许可不得批量复制、转售或用于商业用途。</p>
      </article>

      <article className="policy-section">
        <h2>六、付费与退款</h2>
        <p>当前网站处于沙箱支付阶段，下单与确认不会产生真实扣款。正式支付渠道启用后，订单金额、支付方式与退款规则以支付页面和渠道规则为准。</p>
        <p>若报告或服务因观辰原因未能交付，相关积分将返还；已发生的真实支付退款按支付渠道与适用法律处理。</p>
      </article>

      <article className="policy-section">
        <h2>七、免责声明</h2>
        <ul>
          <li>排盘算法依赖出生资料准确性，资料有误可能影响结果。</li>
          <li>命理内容属于传统文化解释，不代表事实判断或未来承诺。</li>
          <li>因使用解读内容作出的任何现实决策，均由用户自行负责。</li>
          <li>观辰不对不可抗力、网络中断或第三方服务故障造成的损失承担连带责任。</li>
        </ul>
      </article>

      <article className="policy-section">
        <h2>八、服务变更与终止</h2>
        <p>观辰可以根据业务需要调整、暂停或终止部分或全部服务，并提前合理公示。违反本协议或适用法律的账号，观辰可以限制或终止其服务。</p>
      </article>

      <article className="policy-section">
        <h2>九、协议变更</h2>
        <p>本协议可能随产品与法规变化而更新。更新后的协议自公布时生效；涉及重大权利义务变更时，观辰会通过显著方式提示。继续使用服务即视为接受更新后的条款。</p>
      </article>

      <article className="policy-section">
        <h2>十、法律与争议</h2>
        <p>本协议的解释、效力与争议解决适用中华人民共和国法律。因本协议产生的争议，双方应先行友好协商；协商不成的，提交有管辖权的人民法院处理。</p>
      </article>

      <p className="policy-meta">最后更新：2026 年 8 月 12 日</p>
    </PolicyShell>
  );
}
