import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Easing } from "react-native";
import Svg, { Defs, RadialGradient, Stop, Rect } from "react-native-svg";

export default function AnimatedSplash({ onAnimationFinish }) {
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 5,
          tension: 60,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(400),
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 350,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onAnimationFinish();
    });
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      {/* Radial gradient background */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <RadialGradient
            id="splashGradient"
            cx="50%"
            cy="50%"
            rx="75%"
            ry="75%"
            fx="50%"
            fy="50%"
          >
            <Stop offset="0%" stopColor="#302B63" stopOpacity="1" />
            <Stop offset="100%" stopColor="#0F0C29" stopOpacity="1" />
          </RadialGradient>
        </Defs>
        <Rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="url(#splashGradient)"
        />
      </Svg>

      <Animated.Image
        source={require("../../assets/icon.png")}
        style={[
          styles.logo,
          {
            opacity,
            transform: [{ scale }],
          },
        ]}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  logo: {
    width: 160,
    height: 160,
  },
});
