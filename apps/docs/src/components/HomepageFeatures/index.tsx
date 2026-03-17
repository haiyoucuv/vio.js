import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.less';

type FeatureItem = {
  title: string;
  Svg: React.ComponentType<React.ComponentProps<'svg'>>;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: '极致性能',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        基于 uWebSockets.js C++ 网关引擎，跳过 Node.js HTTP 堆栈，获得原生级别的吞吐量与背压控制。
      </>
    ),
  },
  {
    title: '工程化体验',
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
        深度集成 TypeScript 装饰器与 IoC 依赖注入容器，让你的代码结构如 NestJS 般整洁有序。
      </>
    ),
  },
  {
    title: '长连接利器',
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        原生打通 C++ Pub/Sub 系统，内置房间管理与离线安全预案，是开发帧同步游戏的绝佳选择。
      </>
    ),
  },
];

function Feature({title, Svg, description}: FeatureItem) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
