import { View, Text, Image, StyleSheet } from 'react-native';
import React, { useState } from 'react';
// import { IMAGES } from '../../assets/Images';

const image = require('./profile_image.png');

type Props = {
  url?: string;
  containerViewStyles?: any;
  imageStyles?: any;
};

const UserAvatar = ({ url, containerViewStyles, imageStyles }: Props) => {
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  return (
    <View
      style={[
        {
          height: '100%',
          width: '100%',
        },
        { ...containerViewStyles },
      ]}
    >
      {!isImageLoaded ||
        (!url && (
          <Image
            source={image}
            style={[
              styles.userImage,
              {
                ...imageStyles,
              },
            ]}
          />
        ))}
      <Image
        resizeMode="cover"
        source={{ uri: url }}
        style={[
          { ...styles.userImage, opacity: isImageLoaded ? 1 : 0 },
          { ...imageStyles },
        ]}
        onLoadEnd={() => setIsImageLoaded(true)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  userImage: {
    height: '100%',
    width: '100%',
    borderRadius: 100,
  },
});

export default UserAvatar;
